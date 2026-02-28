"""
Modal Product Research LLM
──────────────────────────
Conversational AI that helps users clarify what product they want to find.
Uses Claude Sonnet to ask follow-up questions and produce a structured
product description for downstream search.

Deploy:  modal deploy modal/product_research_llm.py
Serve:   modal serve modal/product_research_llm.py
"""

import json
import re
import os
from typing import Optional
import modal
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse

app = modal.App("product-research-llm")
web_app = FastAPI()

secret = modal.Secret.from_name("anthropic-secret")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]==0.115.4",
        "anthropic>=0.25.0",
        "httpx>=0.27.0",
    )
)

with image.imports():
    import anthropic

SYSTEM_PROMPT = """You are a personal shopping assistant helping users find second-hand products.
Understand exactly what product the user wants, then output a <product_description> JSON block.

When ready, include:
<product_description>
{
  "ready": true,
  "name": "Nike Air Jordan 1",
  "category": "sneakers",
  "brand": "Nike",
  "colorway": "Chicago",
  "size": "10.5 US",
  "condition": "good or better",
  "max_price": 250,
  "keywords": ["jordan 1", "chicago"],
  "image_prompt": "Nike Air Jordan 1 Chicago colorway red white black side profile"
}
</product_description>

Ask at most 3 follow-up questions. If still gathering info, set "ready": false."""


def parse_product_description(text):
    match = re.search(r"<product_description>(.*?)</product_description>", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1).strip())
    except:
        return None


def parse_summary(text):
    match = re.search(r"<summary>(.*?)</summary>", text, re.DOTALL)
    return match.group(1).strip() if match else None


@app.cls(image=image, scaledown_window=1800, secrets=[secret])
class ProductResearchLLM:
    @modal.enter()
    def load(self):
        self.client = anthropic.Anthropic()

    @modal.method()
    def chat(self, messages: list, supermemory_context: str = "") -> dict:
        system = SYSTEM_PROMPT
        if supermemory_context:
            system += f"\n\nUser past preferences:\n{supermemory_context}"
        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        reply = response.content[0].text
        product_desc = parse_product_description(reply)
        return {
            "reply": reply,
            "needs_more_info": product_desc is None or not product_desc.get("ready", False),
            "product_description": product_desc,
            "image_prompt": product_desc.get("image_prompt") if product_desc else None,
        }

    @modal.method()
    def finalize(self, messages: list) -> dict:
        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT + "\n\nUser confirmed. Output final <product_description> and a <summary> of 2-3 sentences for memory storage.",
            messages=messages + [{"role": "user", "content": "Looks good, finalize it."}],
        )
        reply = response.content[0].text
        return {
            "reply": reply,
            "product_description": parse_product_description(reply),
            "summary_for_supermemory": parse_summary(reply),
        }


@web_app.post("/chat")
async def chat_endpoint(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        return JSONResponse({"error": "messages required"}, status_code=400)
    result = await ProductResearchLLM().chat.remote.aio(messages, body.get("supermemory_context", ""))
    return JSONResponse(result)


@web_app.post("/finalize")
async def finalize_endpoint(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        return JSONResponse({"error": "messages required"}, status_code=400)
    result = await ProductResearchLLM().finalize.remote.aio(messages)
    return JSONResponse(result)


@web_app.get("/health")
def health_endpoint():
    return JSONResponse({"status": "ok"})

@app.function(image=image, secrets=[secret])
@modal.asgi_app()
def fastapi_app():
    return web_app
