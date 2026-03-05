"""External checkout service via tmservice.live.

Creates payment sessions and verifies their status. Uses the ASCII
Vigenère cipher to obfuscate the user's password hash before sending
it to the external service.

Checkout state is stored in ``InfluencerSubscriptionPayment`` with
``kind='checkout'``.  The ``provider_payload`` JSON column holds the
extra checkout metadata (payment_url, etc.).
"""

import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    InfluencerSubscriptionPayment,
    User,
)
from app.utils.crypto import vigenere_cipher

log = logging.getLogger(__name__)

# ── HTTP client ──────────────────────────────────────────────────────

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.TMSERVICE_API_URL,
            timeout=30.0,
        )
    return _client


async def close_checkout_client() -> None:
    """Graceful shutdown – call from lifespan."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ── Password obfuscation ─────────────────────────────────────────────


def _cipher_password(password_hash: str) -> str:
    """Cipher a password hash with the configured Vigenère key."""
    return vigenere_cipher(password_hash, settings.TMSERVICE_CIPHER_KEY)


# ── Create checkout ──────────────────────────────────────────────────


async def create_checkout(
    db: AsyncSession,
    *,
    user: User,
    influencer_id: str,
    provider: str,
    amount_cents: int,
) -> InfluencerSubscriptionPayment:
    """
    Call tmservice to create an external checkout session for a credit top-up.

    Stores the checkout as an ``InfluencerSubscriptionPayment``
    with ``kind='checkout'`` and ``status='pending'``.

    Returns the payment record (provider_payload contains payment_url).
    """

    if not amount_cents or amount_cents <= 0:
        raise HTTPException(400, "amount_cents must be positive")

    # ── Build password ────────────────────────────────────────────
    ciphered_password = _cipher_password(user.password_hash or "")

    # ── Call tmservice ────────────────────────────────────────────
    payload = {
        "userEmail": user.email,
        "password": ciphered_password,
        "amount": amount_cents,
        "slug": influencer_id,
        "payment_provider": provider,
        "redirection": settings.TMSERVICE_REDIRECT_URL,
    }

    log.info(
        "checkout.create user=%s provider=%s amount=%d",
        user.id, provider, amount_cents,
    )

    try:
        client = _get_client()
        resp = await client.post(
            "/external/guest-checkout",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": settings.TMSERVICE_API_KEY or "",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        log.error("checkout.tmservice_error status=%s body=%s", e.response.status_code, e.response.text[:300])
        raise HTTPException(502, "Payment service returned an error")
    except httpx.RequestError as e:
        log.error("checkout.tmservice_network_error err=%s", str(e)[:200])
        raise HTTPException(502, "Payment service is unreachable")

    if not data.get("ok"):
        log.error("checkout.tmservice_failed data=%s", str(data)[:300])
        raise HTTPException(502, "Payment service rejected the request")

    checkout_id = data["checkout_id"]
    payment_url = data["payment_url"]

    # ── Store as InfluencerSubscriptionPayment ────────────────────
    provider_payload = {
        "checkout_id": checkout_id,
        "payment_url": payment_url,
    }
    # Provider-specific data
    if provider == "stripe":
        provider_payload["session_id"] = data.get("session_id")
    elif provider == "paypal":
        provider_payload["order_id"] = data.get("order_id")

    payment = InfluencerSubscriptionPayment(
        user_id=user.id,
        influencer_id=influencer_id,
        amount_cents=amount_cents,
        kind="checkout",
        status="pending",
        provider=provider,
        provider_event_id=checkout_id,
        provider_payload=provider_payload,
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    log.info(
        "checkout.created payment_id=%s checkout_id=%s provider=%s amount=%d",
        payment.id, checkout_id, provider, amount_cents,
    )

    return payment


# ── Verify checkout ──────────────────────────────────────────────────


async def verify_checkout(
    db: AsyncSession,
    *,
    checkout_id: str,
    user_id: int,
) -> InfluencerSubscriptionPayment:
    """
    Poll tmservice for checkout status and update the local record.

    NOTE: The exact tmservice verify endpoint is TBD.  For now we
    assume GET /external/checkout-status?checkout_id=<id>.
    """

    payment = await db.scalar(
        select(InfluencerSubscriptionPayment).where(
            InfluencerSubscriptionPayment.provider_event_id == checkout_id,
            InfluencerSubscriptionPayment.user_id == user_id,
            InfluencerSubscriptionPayment.kind == "checkout",
        )
    )

    if not payment:
        raise HTTPException(404, "Checkout session not found")

    if payment.status == "succeeded":
        raise HTTPException(409, "Checkout already completed")

    # ── Poll tmservice ────────────────────────────────────────────
    try:
        client = _get_client()
        resp = await client.get(
            "/external/checkout-status",
            params={"checkout_id": checkout_id},
            headers={"x-api-key": settings.TMSERVICE_API_KEY or ""},
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        log.error("checkout.verify_error status=%s body=%s", e.response.status_code, e.response.text[:300])
        raise HTTPException(502, "Payment service returned an error during verification")
    except httpx.RequestError as e:
        log.error("checkout.verify_network_error err=%s", str(e)[:200])
        raise HTTPException(502, "Payment service is unreachable")

    payment_status = data.get("status", "").lower()

    log.info(
        "checkout.verify checkout_id=%s tmservice_status=%s",
        checkout_id, payment_status,
    )

    if payment_status in ("completed", "paid", "succeeded"):
        payment.status = "succeeded"
    elif payment_status in ("failed", "cancelled", "canceled"):
        payment.status = "failed"
        payment.failure_message = f"tmservice: {payment_status}"
    # else: still pending – no change

    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return payment
