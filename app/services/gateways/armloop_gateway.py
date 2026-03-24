"""Armloop payment gateway client.

Handles payment session creation with HMAC-SHA256 signature authentication
and webhook verification for the Armloop payment platform.
"""

import hmac
import logging
import secrets
import time
from base64 import b64encode
from hashlib import sha256

import httpx
from fastapi import HTTPException

from app.core.config import settings

log = logging.getLogger(__name__)

# ── HTTP client ──────────────────────────────────────────────────────

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    """Get or create HTTP client for Armloop API."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.ARMLOOP_BASE_URL,
            timeout=30.0,
        )
    return _client


async def close_armloop_client() -> None:
    """Graceful shutdown – call from lifespan."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ── Signature generation ─────────────────────────────────────────────


_NONCE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
_NONCE_LENGTH = 16


def _generate_nonce() -> str:
    """Generate 16-char alphanumeric nonce for replay attack prevention.

    Character set matches Armloop's reference pre-script: A-Z, a-z, 0-9.
    """
    return "".join(secrets.choice(_NONCE_CHARS) for _ in range(_NONCE_LENGTH))


def _generate_signature(api_key: str, timestamp: int, nonce: str, secret_key: str) -> str:
    """Generate HMAC-SHA256 signature for Armloop API request.
    
    Args:
        api_key: Armloop API key
        timestamp: Current timestamp in milliseconds
        nonce: Unique random string
        secret_key: Armloop secret key
        
    Returns:
        Base64-encoded HMAC-SHA256 signature
    """
    data = f"{api_key}{timestamp}{nonce}"
    signature = hmac.new(
        secret_key.encode(),
        data.encode(),
        sha256
    ).digest()
    return b64encode(signature).decode()


def _get_signed_headers() -> dict[str, str]:
    """Generate signed headers for Armloop API request."""
    if not settings.ARMLOOP_API_KEY or not settings.ARMLOOP_SECRET_KEY:
        raise ValueError("Armloop credentials not configured")
    
    timestamp = int(time.time() * 1000)  # milliseconds
    nonce = _generate_nonce()
    signature = _generate_signature(
        settings.ARMLOOP_API_KEY,
        timestamp,
        nonce,
        settings.ARMLOOP_SECRET_KEY
    )
    
    return {
        "Armloop-Api-Key": settings.ARMLOOP_API_KEY,
        "Armloop-Timestamp": str(timestamp),
        "Armloop-Nonce": nonce,
        "Armloop-Sign": signature,
        "Content-Type": "application/json",
    }


# ── Payment session creation ─────────────────────────────────────────


async def create_payment_session(
    transaction_id: str,
    amount_cents: int,
    return_url: str | None = None,
    mode: str = "hosted",
) -> dict:
    """Create Armloop payment session.
    
    Args:
        transaction_id: Unique transaction reference (your order ID)
        amount_cents: Payment amount in cents
        return_url: URL to redirect user after payment (optional)
        mode: Integration mode - "hosted" for redirect, "embedded" for Drop-in/Components
        
    Returns:
        dict with session details including checkout URL (for hosted mode)
        
    Raises:
        HTTPException: If payment session creation fails
    """
    if not amount_cents or amount_cents <= 0:
        raise HTTPException(400, "amount_cents must be positive")
    
    payload: dict = {
        "transactionId": transaction_id,
        "amount": str(amount_cents),
        "surchargeAmount": 0,
        "mode": mode,
    }

    if settings.ARMLOOP_MERCHANT_ACCOUNT:
        payload["merchantAccount"] = settings.ARMLOOP_MERCHANT_ACCOUNT

    if return_url:
        payload["returnUrl"] = return_url
    elif settings.ARMLOOP_RETURN_URL:
        payload["returnUrl"] = settings.ARMLOOP_RETURN_URL

    log.info(
        "armloop.create_session transaction_id=%s amount=%d mode=%s merchant=%s",
        transaction_id, amount_cents, mode, settings.ARMLOOP_MERCHANT_ACCOUNT,
    )

    try:
        client = _get_client()
        headers = _get_signed_headers()

        resp = await client.post(
            "/session",
            json=payload,
            headers=headers,
        )

        log.debug(
            "armloop.response status=%s body_len=%s",
            resp.status_code, len(resp.text or ""),
        )

        resp.raise_for_status()
        data = resp.json()

        # Armloop always includes an "error" key; only treat it as a failure
        # when success is explicitly False or the error value is non-null.
        if not data.get("success") or data.get("error"):
            log.error(
                "armloop.api_rejected transaction_id=%s response=%s",
                transaction_id, data,
            )
            raise HTTPException(502, f"Armloop rejected the request: {data.get('error')}")

        # Session payload is nested under "result"
        result = data.get("result") or {}

        log.info(
            "armloop.session_created session_id=%s transaction_id=%s",
            result.get("id"), transaction_id,
        )

        return result

    except httpx.HTTPStatusError as e:
        log.error(
            "armloop.api_error status=%s body=%s",
            e.response.status_code, e.response.text[:500]
        )
        raise HTTPException(502, f"Armloop API error {e.response.status_code}: {e.response.text[:200]}")
    except httpx.RequestError as e:
        log.error("armloop.network_error err=%s", str(e)[:200])
        raise HTTPException(502, "Armloop API is unreachable")


# ── Webhook verification ─────────────────────────────────────────────


def verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """Verify Armloop webhook HMAC signature.
    
    The webhook uses a different signature method than API requests:
    - HMAC key is hex-encoded in the Armloop OA console
    - Must hex-decode before using for HMAC calculation
    
    Args:
        raw_body: Raw request body bytes
        signature_header: Value from X-Signature header
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not settings.ARMLOOP_WEBHOOK_HMAC_KEY:
        log.error("ARMLOOP_WEBHOOK_HMAC_KEY not configured — refusing to verify webhook signature")
        raise HTTPException(
            status_code=500,
            detail="Webhook signature verification is not configured",
        )
    
    try:
        # Hex-decode the HMAC key from config
        hmac_key_bytes = bytes.fromhex(settings.ARMLOOP_WEBHOOK_HMAC_KEY)
        
        # Calculate signature
        calculated = hmac.new(
            hmac_key_bytes,
            raw_body,
            sha256
        ).digest()
        calculated_b64 = b64encode(calculated).decode()
        
        # Compare with header
        return hmac.compare_digest(calculated_b64, signature_header)
        
    except ValueError as e:
        log.error("armloop.webhook_signature_error err=%s", str(e))
        return False
