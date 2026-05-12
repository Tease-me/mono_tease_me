"""Outbound MJ First Promoter webhooks (TeaseMe → MJFP)."""

import logging
from urllib.parse import urlparse

import httpx

log = logging.getLogger(__name__)


def _mjfp_webhook_log_target(url: str) -> str:
    """Log host + path only (no query) for support without leaking tokens."""
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}{p.path}" or url[:200]
    except Exception:
        return url[:200]


async def post_mjfp_teaseme_step_webhook(*, url: str, secret: str, payload: dict) -> None:
    """POST JSON to MJFP. Logs failures; does not raise for transport errors."""
    headers = {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
    }
    target = _mjfp_webhook_log_target(url)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.is_success:
                return
            log.warning(
                "[mjfp-webhook] non-success url=%s status=%s body=%s",
                target,
                response.status_code,
                response.text[:500],
            )
    except httpx.RequestError as exc:
        # str(exc) is often empty; repr + type + __cause__ surface TLS/DNS/refused details.
        cause = exc.__cause__ or exc.__context__
        log.warning(
            "[mjfp-webhook] request error url=%s type=%s detail=%r cause=%r",
            target,
            type(exc).__name__,
            exc,
            cause,
        )
