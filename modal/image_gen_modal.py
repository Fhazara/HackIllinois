"""
Modal Image Generation Endpoint
User description -> enhanced prompt -> SD 3.5 Large Turbo image

Deploy:       modal serve modal/image_gen_modal.py
Deploy prod:  modal deploy modal/image_gen_modal.py

GET /generate?q=black+dunk+low
GET /generate?q=vintage+leather+jacket&seed=42
Returns: PNG image bytes + X-Gen-Ms header

Use in Next.js: set MODAL_URL in .env to the printed URL (e.g. https://USER--product-image-gen-generate.modal.run).
The app uses /api/generate-image which proxies to this endpoint.
"""
import io
import random
from typing import Optional

import modal
from fastapi import Response
from fastapi.responses import JSONResponse

app = modal.App("product-image-gen")
CACHE_DIR = "/cache"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]==0.115.4",
        "accelerate==0.33.0",
        "diffusers==0.31.0",
        "huggingface-hub==0.36.0",
        "sentencepiece==0.2.0",
        "torch==2.5.1",
        "torchvision==0.20.1",
        "transformers~=4.44.0",
    )
    .env({"HF_HUB_CACHE": CACHE_DIR})
)
cache_volume = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

with image.imports():
    import diffusers
    import torch

MODEL_ID = "adamo1139/stable-diffusion-3.5-large-turbo-ungated"
MODEL_REVISION = "9ad870ac0b0e5e48ced156bb02f85d324b7275d2"


def build_prompt(user_input: str) -> str:
    base = user_input.strip()
    return (
        f"Ultra realistic studio product photo of {base}, "
        "isolated on pure white background, soft shadow beneath, "
        "sharp focus, professional lighting, 4k, high detail, "
        "shot from slight angle showing depth"
    )


@app.cls(
    image=image,
    gpu="A100",
    timeout=600,
    volumes={CACHE_DIR: cache_volume},
    scaledown_window=1800,
)
class ImageGen:
    @modal.enter()
    def load(self):
        self.pipe = diffusers.StableDiffusion3Pipeline.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            torch_dtype=torch.bfloat16,
        ).to("cuda")

    @modal.method()
    def generate(self, prompt: str, seed: Optional[int] = None) -> bytes:
        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        torch.manual_seed(seed)
        img = self.pipe(
            prompt,
            num_images_per_prompt=1,
            num_inference_steps=4,
            guidance_scale=0.0,
            max_sequence_length=512,
        ).images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def generate(
    q: str = "product",
    seed: Optional[int] = None,
    debug: bool = False,
):
    import time

    if not q or not q.strip():
        return JSONResponse({"error": "q param is required"}, status_code=400)
    prompt = build_prompt(q)
    if debug:
        return JSONResponse({"prompt": prompt, "seed": seed})
    t0 = time.perf_counter()
    png = ImageGen().generate.remote(prompt, seed)
    ms = int((time.perf_counter() - t0) * 1000)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Gen-Ms": str(ms),
            "X-Prompt": prompt[:200],
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health():
    return JSONResponse({"status": "ok", "model": MODEL_ID})
