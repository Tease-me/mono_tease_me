"""xAI Grok Imagine API gateway for image variation generation."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

XAI_IMAGES_BASE = "https://api.x.ai/v1"
DEFAULT_IMAGE_MODEL = "grok-imagine-image"

FACE_OUTFIT_MERGE_PROMPT = (
    "Composite IMAGE_0 and IMAGE_1 into one photorealistic image. "
    "Take only the face, facial features, skin tone, and hairstyle from IMAGE_0. "
    "Keep the entire body pose, outfit, clothing, accessories, room, and background "
    "environment exactly as shown in IMAGE_1 — do not crop, blur, or replace the background. "
    "The final image must show the person from IMAGE_0 in the full scene from IMAGE_1."
)

LOOPING_VIDEO_BACKGROUND_SUFFIX = (
    " Keep the exact same background, room, lighting, and environment as the source image. "
    "Do not change or replace the scene. Seamless looping video with subtle natural motion only."
)


class XaiImagineError(RuntimeError):
    """Raised when xAI Imagine API returns an error."""


def _bytes_to_data_uri(image_bytes: bytes, content_type: str) -> str:
    mime = content_type.split(";", 1)[0].strip() or "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime};base64,{encoded}"


async def _post_image_edits(payload: dict[str, Any], *, model: str | None = None) -> list[dict[str, Any]]:
    resolved_model = model or getattr(settings, "XAI_IMAGINE_IMAGE_MODEL", DEFAULT_IMAGE_MODEL)
    payload = {**payload, "model": resolved_model}

    headers = {
        "Authorization": f"Bearer {settings.XAI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0)) as client:
        response = await client.post(
            f"{XAI_IMAGES_BASE}/images/edits",
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        log.error(
            "xai_imagine.edits_failed status=%s body=%s",
            response.status_code,
            response.text[:500],
        )
        raise XaiImagineError(
            f"xAI image edit failed ({response.status_code}): {response.text[:200]}"
        )

    body = response.json()
    data = body.get("data") or []
    if not data:
        raise XaiImagineError("xAI returned no image variations")

    return list(data)


async def edit_images_multi(
    *,
    source_images: list[tuple[bytes, str]],
    prompt: str,
    n: int = 1,
    model: str | None = None,
) -> list[dict[str, Any]]:
    """
    Multi-reference image edit (up to 3 images). Refer to images as IMAGE_0, IMAGE_1, etc.
    """
    if not source_images:
        raise ValueError("At least one source image is required")
    if len(source_images) > 3:
        raise ValueError("xAI supports at most 3 source images")
    if n < 1 or n > 10:
        raise ValueError("n must be between 1 and 10")

    payload: dict[str, Any] = {
        "prompt": prompt,
        "images": [
            {"url": _bytes_to_data_uri(image_bytes, content_type), "type": "image_url"}
            for image_bytes, content_type in source_images
        ],
        "n": n,
        "response_format": "url",
        "aspect_ratio": "auto",
        "resolution": "1k",
    }
    return await _post_image_edits(payload, model=model)


async def generate_image_variations(
    *,
    source_image_bytes: bytes,
    source_content_type: str,
    prompt: str,
    n: int = 5,
    model: str | None = None,
) -> list[dict[str, Any]]:
    """
    Generate image variations from a source photo using Grok Imagine edits API.

    Returns a list of result dicts with keys: url (optional), b64_json (optional).
    """
    if n < 1 or n > 10:
        raise ValueError("n must be between 1 and 10")

    mime = source_content_type.split(";", 1)[0].strip() or "image/jpeg"
    data_uri = _bytes_to_data_uri(source_image_bytes, mime)
    resolved_model = model or getattr(settings, "XAI_IMAGINE_IMAGE_MODEL", DEFAULT_IMAGE_MODEL)

    payload: dict[str, Any] = {
        "prompt": prompt,
        "image": {
            "url": data_uri,
            "type": "image_url",
        },
        "n": n,
        "response_format": "url",
        "aspect_ratio": "9:16",
        "resolution": "1k",
    }

    return await _post_image_edits(payload, model=resolved_model)
