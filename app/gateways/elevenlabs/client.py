"""Shared ElevenLabs HTTP client lifecycle."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_elevenlabs_client: Optional[httpx.AsyncClient] = None


async def get_elevenlabs_client() -> httpx.AsyncClient:
    """Get or create a shared HTTP client with connection pooling for ElevenLabs API."""
    global _elevenlabs_client
    if _elevenlabs_client is None:
        _elevenlabs_client = httpx.AsyncClient(
            http2=True,
            base_url=settings.ELEVEN_BASE_URL,
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=50,
                keepalive_expiry=30.0,
            ),
        )
        log.info("Created shared ElevenLabs HTTP client with connection pooling")
    return _elevenlabs_client


async def close_elevenlabs_client() -> None:
    """Close the shared ElevenLabs HTTP client gracefully."""
    global _elevenlabs_client
    if _elevenlabs_client is not None:
        await _elevenlabs_client.aclose()
        _elevenlabs_client = None
        log.info("Closed ElevenLabs HTTP client")
