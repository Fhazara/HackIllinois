"""
Modal Product Research LLM — "Omniscient Scout"
───────────────────────────────────────────────
Universal personal shopping agent. Uses Gemini 2.0 Flash + Supermemory
for category-agnostic product discovery and preference/anti-preference memory.

Deploy:  modal deploy modal/product_research_llm.py
Serve:   modal serve modal/product_research_llm.py
"""

import json
import re
import os
import modal
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse

app = modal.App("product-research-llm")
web_app = FastAPI()

# Gemini + Supermemory (sponsor secrets)
secrets = [
    modal.Secret.from_name("gemini-secret"),
    modal.Secret.from_name("supermemory-secret", required_keys=[]),
]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]==0.115.4",
        "google-generativeai>=0.7.0",
        "supermemory>=0.1.0",
    )
)

with image.imports():
    import google.generativeai as genai
    from supermemory import Supermemory

SYSTEM_PROMPT = """You are the 'Omniscient Scout,' a universal personal shopping agent.
You find ANY product—from high-end GPUs to vintage fashion, furniture, home goods, and more.

### WHEN THE USER SENDS AN IMAGE (photo attached):
- **First reply only:** Identify what you see in the image (e.g. "That looks like a Ferrari F1 racing jacket—black with red accents and sponsor logos.") and ask 1–3 follow-up questions: size, budget, condition (new/used), or any style preference. Do NOT output <product_description> or ready: true on this turn. Do not output any JSON. Just identify + ask questions.
- **After the user replies** (with answers or "no preference"): Then and only then output the <product_description> with ready: true, including the 3 image_prompts. Then the app will generate 3 reference images and the user can confirm before you scrape. So: image → your turn = identify + questions → user's turn = answers → your turn = product block + 3 image_prompts.

### YOUR CORE PROTOCOL:
1. CURRENT REQUEST IS KING: Always respond to what the user is asking for NOW. Do NOT suggest or bias toward items from past searches or a different category (e.g. if they asked for PANTS, image_prompts and product must be pants—never shoes, jackets, or anything else).
2. MEMORY IS FOR AVOIDING ONLY: "User Memory" is only for things to AVOID. When you write image_prompts, ignore memory entirely—base them ONLY on what the user asked for in THIS conversation (same category and product type).
3. CATEGORY AGNOSTIC: Do not assume the user wants shoes. If they said pants, output pants. If they said jacket, output jacket. Match the category they asked for exactly.
4. SUPPLEMENTARY QUESTIONS BEFORE OUTPUT: Do NOT output a <product_description> with ready: true on the first reply—whether the user sent text only or an image. Always ask 1–3 follow-up questions first (size, budget, style, condition). Only after the user has replied at least once with answers (or skipped), output the <product_description> with ready: true.
5. STRUCTURED OUTPUT: When you have enough info (after follow-ups), output a <product_description> JSON block.

<product_description> JSON Schema:
{
  "ready": boolean,
  "name": "Full product name",
  "category": "Electronics, Fashion, Home, etc.",
  "specifications": {"primary": "Size/Model", "secondary": "Color/Specs"},
  "anti_preferences": ["Traits to avoid based on past dislikes"],
  "max_price": number,
  "keywords": ["Optimized Search Terms"],
  "image_prompt": "One main studio product photo prompt (fallback)",
  "image_prompts": ["Prompt for reference image 1", "Prompt for reference image 2", "Prompt for reference image 3"]
}
</product_description>

### image_prompts — CRITICAL (3 DISTINCT STYLES SO USER CAN CHOOSE):
- **Purpose:** The user must see 3 clearly DIFFERENT styles/variations so they can pick one. If all 3 look like the same product, the user has no way to narrow down. Each prompt = a different SUBCATEGORY or STYLE.
- **Category match:** All 3 must be the category the user asked for (pants → all pants; shoes → all shoes). Never mix categories or use memory/past searches.
- **Running/athletic shoes:** Do NOT output 3 similar "black running shoe" prompts. Use 3 distinct sub-styles, e.g.: (1) minimalist racing flat / lightweight low-profile, (2) cushioned daily trainer / thick sole comfort, (3) trail running shoe / rugged lugged outsole. Or: racing, lifestyle casual, cross-training. Each prompt must describe a visibly different type.
- **Pants:** Do NOT output 3 similar "black pants". Use 3 distinct types, e.g.: (1) chino / casual trouser, (2) joggers / tapered sweatpant style, (3) dress trousers / formal. Or: slim chino, relaxed fit, pleated dress. Each prompt must describe a visibly different style.
- **Jackets:** (1) biker/leather, (2) denim/trucker, (3) bomber or field jacket—different silhouettes.
- **Bad:** Three prompts that differ only by "front view", "side view", "white background"—or "black running shoe" three times with minor word changes. The 3 images must look like 3 different products the user could choose between.
- Each prompt: full product description for a studio photo (e.g. "Black minimalist racing flat running shoe, mesh upper, white background, product shot").

Only set "ready": true and output <product_description> after you have asked at least one round of follow-up questions and have enough tags (e.g. size, budget, or style) to make the search useful. If the user just gave a first message—whether text (e.g. "black athletic shoes") or an image (e.g. photo of a jacket)—always reply with identify + follow-up questions only; do not output the product block until the user has replied at least once more."""

FINALIZE_SYSTEM = SYSTEM_PROMPT + "\n\nUser confirmed. Output final <product_description> and a <summary> of 2-3 sentences for memory storage."


def parse_product_description(text):
    match = re.search(r"<product_description>(.*?)</product_description>", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1).strip())
    except Exception:
        return None


def parse_summary(text):
    match = re.search(r"<summary>(.*?)</summary>", text, re.DOTALL)
    return match.group(1).strip() if match else None


def _message_to_parts(m):
    """Build Gemini parts list: optional image then text."""
    parts = []
    if m.get("image"):
        parts.append({
            "inline_data": {
                "mime_type": m.get("image_mime") or "image/jpeg",
                "data": m["image"],
            }
        })
    parts.append({"text": m.get("content") or ""})
    return parts


def to_gemini_history(messages):
    history = []
    for m in messages[:-1]:
        role = "user" if m["role"] == "user" else "model"
        history.append({"role": role, "parts": _message_to_parts(m)})
    return history


def _strip_images(messages):
    """Return a copy of messages with image data removed (for RPC transport)."""
    stripped = []
    for m in messages:
        clean = {k: v for k, v in m.items() if k not in ("image", "image_data")}
        # Keep a flag so we know an image was present
        if m.get("image"):
            clean["_had_image"] = True
            clean["image_mime"] = m.get("image_mime", "image/jpeg")
        stripped.append(clean)
    return stripped


@app.cls(image=image, scaledown_window=1800, secrets=secrets)
class ProductResearchLLM:
    @modal.enter()
    def load(self):
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        sm_key = os.environ.get("SUPERMEMORY_API_KEY")
        self.sm_client = Supermemory(api_key=sm_key) if sm_key else None
        # Override via Modal secret GEMINI_MODEL. Default: stable 2.5 Flash (from List Models).
        model_id = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        self.model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=SYSTEM_PROMPT,
        )
        self.model_finalize = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=FINALIZE_SYSTEM,
        )

    @modal.method()
    async def chat(self, messages: list, supermemory_context: str = "") -> dict:
        user_id = "user_default"
        last_query = messages[-1]["content"]
        context = supermemory_context or "No previous memory found."

        # 1. Fetch memory context from Supermemory (optional)
        try:
            profile = self.sm_client.profile(container_tag=user_id, q=last_query)
            static = getattr(profile.profile, "static", None) or []
            dynamic = getattr(profile.profile, "dynamic", None) or []
            if isinstance(static, list):
                static = "\n".join(static) if static else "None"
            if isinstance(dynamic, list):
                dynamic = "\n".join(dynamic) if dynamic else "None"
            context = f"Static Prefs: {static}\nDynamic Context: {dynamic}"
        except Exception:
            pass

        # 2. Call Gemini: current query is primary; include image in last turn if present
        history = to_gemini_history(messages)
        chat_session = self.model.start_chat(history=history)
        memory_prompt = (
            f"[THINGS TO AVOID — only use to filter out, do not suggest these]:\n{context}\n\n"
            f"[CURRENT REQUEST — respond only to this]: {last_query}"
        )
        last_msg = messages[-1]
        if last_msg.get("image"):
            parts = [
                {"inline_data": {"mime_type": last_msg.get("image_mime") or "image/jpeg", "data": last_msg["image"]}},
                {"text": memory_prompt},
            ]
            response = chat_session.send_message(parts)
        else:
            response = chat_session.send_message(memory_prompt)
        reply = response.text

        # 3. Add to memory (Supermemory uses container_tag singular)
        try:
            self.sm_client.add(
                content=f"User search: {last_query}. Assistant found: {reply}",
                container_tag=user_id,
            )
        except Exception:
            pass

        product_desc = parse_product_description(reply)
        return {
            "reply": reply,
            "needs_more_info": product_desc is None or not product_desc.get("ready", False),
            "product_description": product_desc,
            "image_prompt": product_desc.get("image_prompt") if product_desc else None,
        }

    @modal.method()
    async def chat_without_image(self, messages_no_images: list, supermemory_context: str = "") -> dict:
        """Same as chat() but for messages that had images stripped for RPC transport."""
        return await self.chat(messages_no_images, supermemory_context)

    @modal.method()
    async def finalize(self, messages: list) -> dict:
        user_id = "user_default"
        history = to_gemini_history(messages)
        chat_session = self.model_finalize.start_chat(history=history)
        response = chat_session.send_message("Looks good, finalize it.")
        reply = response.text
        product_desc = parse_product_description(reply)
        summary = parse_summary(reply)

        # Store final summary in Supermemory
        if summary:
            try:
                self.sm_client.add(
                    content=f"Finalized search: {summary}",
                    container_tag=user_id,
                )
            except Exception:
                pass

        return {
            "reply": reply,
            "product_description": product_desc,
            "summary_for_supermemory": summary,
        }


@web_app.post("/chat")
async def chat_endpoint(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        return JSONResponse({"error": "messages required"}, status_code=400)
    
    # Check if any message contains image data (which would be too large for Modal RPC)
    has_images = any(m.get("image") for m in messages)
    
    try:
        if has_images:
            # Images are too large for Modal's RPC serialization (~2MB limit).
            # Run Gemini directly in this ASGI handler instead.
            import google.generativeai as genai_local
            from supermemory import Supermemory as SM
            
            genai_local.configure(api_key=os.environ["GEMINI_API_KEY"])
            sm_key = os.environ.get("SUPERMEMORY_API_KEY")
            sm_client = SM(api_key=sm_key) if sm_key else None
            model_id = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
            model = genai_local.GenerativeModel(
                model_name=model_id,
                system_instruction=SYSTEM_PROMPT,
            )
            
            user_id = "user_default"
            last_query = messages[-1]["content"]
            context = "No previous memory found."
            
            try:
                profile = sm_client.profile(container_tag=user_id, q=last_query)
                static = getattr(profile.profile, "static", None) or []
                dynamic = getattr(profile.profile, "dynamic", None) or []
                if isinstance(static, list):
                    static = "\n".join(static) if static else "None"
                if isinstance(dynamic, list):
                    dynamic = "\n".join(dynamic) if dynamic else "None"
                context = f"Static Prefs: {static}\nDynamic Context: {dynamic}"
            except Exception:
                pass
            
            history = to_gemini_history(messages)
            chat_session = model.start_chat(history=history)
            memory_prompt = (
                f"[THINGS TO AVOID — only use to filter out, do not suggest these]:\n{context}\n\n"
                f"[CURRENT REQUEST — respond only to this]: {last_query}"
            )
            last_msg = messages[-1]
            if last_msg.get("image"):
                parts = [
                    {"inline_data": {"mime_type": last_msg.get("image_mime") or "image/jpeg", "data": last_msg["image"]}},
                    {"text": memory_prompt},
                ]
                response = chat_session.send_message(parts)
            else:
                response = chat_session.send_message(memory_prompt)
            reply = response.text
            
            try:
                sm_client.add(
                    content=f"User search: {last_query}. Assistant found: {reply}",
                    container_tag=user_id,
                )
            except Exception:
                pass
            
            product_desc = parse_product_description(reply)
            result = {
                "reply": reply,
                "needs_more_info": product_desc is None or not product_desc.get("ready", False),
                "product_description": product_desc,
                "image_prompt": product_desc.get("image_prompt") if product_desc else None,
            }
        else:
            # No images — safe to use Modal RPC
            result = await ProductResearchLLM().chat.remote.aio(
                messages,
                body.get("supermemory_context", ""),
            )
        return JSONResponse(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {
                "reply": "Sorry, something went wrong on the server. Please try again.",
                "needs_more_info": True,
                "product_description": None,
                "image_prompt": None,
                "_error": str(e),
            },
            status_code=200,
        )


@web_app.post("/finalize")
async def finalize_endpoint(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        return JSONResponse({"error": "messages required"}, status_code=400)
    # Strip images from finalize (not needed, saves RPC bandwidth)
    clean_messages = _strip_images(messages)
    result = await ProductResearchLLM().finalize.remote.aio(clean_messages)
    return JSONResponse(result)


@web_app.get("/health")
def health_endpoint():
    return JSONResponse({"status": "Scout Live with Supermemory"})


@app.function(image=image, secrets=secrets)
@modal.asgi_app(label="product-research-llm-chat")
def fastapi_app():
    return web_app
