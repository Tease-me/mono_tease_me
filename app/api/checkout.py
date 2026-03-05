"""
External payment confirmation webhook.

Receives `payment.completed` events from the checkout service (Stripe/PayPal),
validates the HMAC signature, guards against duplicate processing, and credits
the user's influencer wallet via the existing `topup_wallet` service.
"""

import hmac
import logging
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User, InfluencerCreditTransaction
from app.db.session import get_db
from app.schemas.checkout import PaymentWebhookPayload
from app.services.billing import topup_wallet

log = logging.getLogger(__name__)

router = APIRouter(prefix="/checkout", tags=["checkout"])


def _verify_signature(raw_body: bytes, signature: str | None) -> None:
    """Verify HMAC-SHA256 signature against the configured webhook secret."""
    secret = settings.PAYMENT_WEBHOOK_SECRET
    if not secret:
        log.warning("PAYMENT_WEBHOOK_SECRET is not configured — skipping signature verification")
        return

    if not signature:
        raise HTTPException(status_code=401, detail="Missing X-Webhook-Signature header")

    expected = hmac.new(secret.encode(), raw_body, sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_signature: str | None = Header(default=None),
):
    # ── 1. Read raw body & verify HMAC ──────────────────────────────
    raw_body = await request.body()
    _verify_signature(raw_body, x_webhook_signature)

    # ── 2. Parse & validate payload ─────────────────────────────────
    try:
        payload = PaymentWebhookPayload.model_validate_json(raw_body)
    except Exception as exc:
        log.warning("Webhook payload validation failed: %s", exc)
        raise HTTPException(status_code=422, detail="Invalid payload") from exc

    if payload.event != "payment.completed":
        log.info("Ignoring webhook event: %s", payload.event)
        return {"ok": True, "skipped": True, "reason": f"Unhandled event: {payload.event}"}

    source = f"checkout:{payload.checkout_id}"

    # ── 3. Idempotency: check if already processed ──────────────────
    existing_tx = await db.scalar(
        select(InfluencerCreditTransaction).where(
            and_(
                InfluencerCreditTransaction.user_id == payload.user_id,
                InfluencerCreditTransaction.influencer_id == payload.influencer_id,
                InfluencerCreditTransaction.feature == "topup",
                InfluencerCreditTransaction.meta["source"].as_string() == source,
            )
        )
    )
    if existing_tx:
        log.info("Duplicate webhook for checkout_id=%s — already processed", payload.checkout_id)
        return {"ok": True, "duplicate": True}

    # ── 4. Resolve user ─────────────────────────────────────────────
    user = await db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {payload.user_id} not found")

    # ── 5. Credit the wallet ────────────────────────────────────────
    try:
        new_balance = await topup_wallet(
            db,
            user_id=user.id,
            influencer_id=payload.influencer_id,
            cents=payload.balance_cents,
            source=source,
            is_18=False,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        log.exception("payment_webhook: failed to credit wallet for checkout_id=%s", payload.checkout_id)
        raise HTTPException(status_code=500, detail="Internal error processing payment")

    log.info(
        "Payment credited: user=%s influencer=%s cents=%s new_balance=%s checkout_id=%s provider=%s",
        payload.user_id,
        payload.influencer_id,
        payload.balance_cents,
        new_balance,
        payload.checkout_id,
        payload.provider,
    )

    return {
        "ok": True,
        "user_id": payload.user_id,
        "influencer_id": payload.influencer_id,
        "credited_cents": payload.balance_cents,
        "new_balance_cents": new_balance,
    }
