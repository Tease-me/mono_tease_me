"""xAI Grok Imagine API gateway for image-to-video generation."""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

XAI_API_BASE = "https://api.x.ai/v1"
DEFAULT_VIDEO_MODEL = "grok-imagine-video-1.5"
SUPPORTED_VIDEO_ASPECT_RATIOS = frozenset(
    {"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"}
)

SUBTLE_LOOP_VIDEO_PROMPT = (
    "Very subtle natural motion only: gentle breathing, soft blinking, tiny facial micro-expressions. "
    "Keep the exact same person, pose, outfit, framing, and background as the source image. "
    "No camera movement, no zoom, no scene changes, no large body motion. "
    "Seamless looping video."
)


class XaiImagineVideoError(RuntimeError):
    """Raised when xAI video generation fails."""


def _video_prompt(user_prompt: str) -> str:
    base = user_prompt.strip()
    if not base:
        return SUBTLE_LOOP_VIDEO_PROMPT
    lowered = base.lower()
    if "seamless looping video" in lowered and "same person" in lowered:
        return base
    if "seamless looping video" in lowered:
        return base
    return f"{base.rstrip('.')}. {SUBTLE_LOOP_VIDEO_PROMPT}"


def _resolve_aspect_ratio(aspect_ratio: str | None) -> str | None:
    """Return a supported ratio, or None to inherit the source image dimensions."""
    resolved = (aspect_ratio or getattr(settings, "XAI_IMAGINE_VIDEO_ASPECT_RATIO", "auto")).strip()
    if not resolved or resolved.lower() == "auto":
        return None
    if resolved not in SUPPORTED_VIDEO_ASPECT_RATIOS:
        raise XaiImagineVideoError(
            f"Unsupported video aspect_ratio {resolved!r}. "
            f"Use one of {sorted(SUPPORTED_VIDEO_ASPECT_RATIOS)} or 'auto'."
        )
    return resolved


async def generate_video_from_image(
    *,
    source_image_bytes: bytes,
    source_content_type: str,
    prompt: str,
    duration: int | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
    model: str | None = None,
    poll_interval_seconds: float = 5.0,
    max_wait_seconds: float = 600.0,
) -> str:
    """
    Animate a still image into a video using Grok Imagine Video.

    Returns the temporary download URL for the completed video.
    """
    mime = source_content_type.split(";", 1)[0].strip() or "image/jpeg"
    encoded = base64.b64encode(source_image_bytes).decode("ascii")
    data_uri = f"data:{mime};base64,{encoded}"

    resolved_model = model or getattr(settings, "XAI_IMAGINE_VIDEO_MODEL", DEFAULT_VIDEO_MODEL)
    resolved_duration = duration or getattr(settings, "XAI_IMAGINE_VIDEO_DURATION", 6)
    resolved_resolution = resolution or getattr(settings, "XAI_IMAGINE_VIDEO_RESOLUTION", "720p")
    resolved_aspect_ratio = _resolve_aspect_ratio(aspect_ratio)

    payload: dict[str, Any] = {
        "model": resolved_model,
        "prompt": _video_prompt(prompt),
        "image": {"url": data_uri},
        "duration": resolved_duration,
        "resolution": resolved_resolution,
    }
    if resolved_aspect_ratio:
        payload["aspect_ratio"] = resolved_aspect_ratio

    headers = {
        "Authorization": f"Bearer {settings.XAI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        start_response = await client.post(
            f"{XAI_API_BASE}/videos/generations",
            headers=headers,
            json=payload,
        )

        if start_response.status_code >= 400:
            log.error(
                "xai_imagine.video_start_failed status=%s body=%s",
                start_response.status_code,
                start_response.text[:500],
            )
            raise XaiImagineVideoError(
                f"xAI video start failed ({start_response.status_code}): "
                f"{start_response.text[:200]}"
            )

        start_body = start_response.json()
        request_id = start_body.get("request_id")
        if not request_id:
            raise XaiImagineVideoError("xAI video start returned no request_id")

        deadline = time.monotonic() + max_wait_seconds
        while time.monotonic() < deadline:
            poll_response = await client.get(
                f"{XAI_API_BASE}/videos/{request_id}",
                headers=headers,
            )
            if poll_response.status_code >= 400:
                raise XaiImagineVideoError(
                    f"xAI video poll failed ({poll_response.status_code}): "
                    f"{poll_response.text[:200]}"
                )

            poll_body = poll_response.json()
            status = (poll_body.get("status") or "").lower()
            if status == "done":
                video = poll_body.get("video") or {}
                url = video.get("url")
                if not url:
                    raise XaiImagineVideoError("xAI video completed without a URL")
                return url
            if status in {"failed", "expired"}:
                detail = poll_body.get("error") or poll_body.get("message") or poll_body
                raise XaiImagineVideoError(f"xAI video generation {status}: {detail}")

            await asyncio.sleep(poll_interval_seconds)

    raise XaiImagineVideoError(f"xAI video timed out after {max_wait_seconds:.0f}s")
