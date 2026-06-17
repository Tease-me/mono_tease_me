"""MJ Promoter promo code verification gateway (TeaseMe → MJPromoter)."""

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


async def verify_mjp_promo_code(*, promo_code: str, email: str) -> dict:
    """POST to MJ Promoter to verify and atomically claim a gifted promo code.

    Raises:
        httpx.RequestError: on network / DNS / TLS failures.
        httpx.HTTPStatusError: on non-2xx HTTP responses.

    Returns the parsed JSON response dict on success.  The caller is
    responsible for inspecting ``result["valid"]`` before granting diamonds.
    """
    url = (settings.MJFP_VERIFY_PROMO_CODE_URL or "").strip()
    secret = settings.MJFP_WEBHOOK_SECRET or ""

    headers = {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
    }
    payload = {"promo_code": promo_code, "email": email}

    log.debug("[mjp-promo-gw] verifying promo_code=%s email=%s", promo_code, email)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
