
import asyncio
import hmac
import logging
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.data.models import User, PayPalTopUp, Influencer
from app.core.session import get_db
from app.data.schemas.checkout import PaymentWebhookPayload
from app.services.billing import topup_wallet
from app.services.firstpromoter import fp_track_sale_v2

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

    # ── 3. Look up our local checkout record (source of truth) ──────
    topup = await db.scalar(
        select(PayPalTopUp).where(PayPalTopUp.order_id == payload.checkout_id)
    )
    if not topup:
        log.error("No PayPalTopUp record for checkout_id=%s — cannot process", payload.checkout_id)
        raise HTTPException(status_code=404, detail="Unknown checkout_id")

    if topup.credited:
        log.info("Duplicate webhook for checkout_id=%s — already processed", payload.checkout_id)
        return {"ok": True, "duplicate": True}

    # ── 4. Resolve user & influencer from our DB ────────────────────
    user = await db.get(User, topup.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    influencer = await db.get(Influencer, topup.influencer_id)

    source = f"checkout:{payload.checkout_id}"

    # ── 5. Credit the wallet ────────────────────────────────────────
    try:
        new_balance = await topup_wallet(
            db,
            user_id=topup.user_id,
            influencer_id=topup.influencer_id,
            cents=topup.cents,
            source=source,
            is_18=False,
        )

        topup.status = "COMPLETED"
        topup.credited = True
        db.add(topup)
        await db.commit()

        # Fire-and-forget funnel tracking for first payment
        if topup.influencer_id:
            from app.services.funnel_tracking_service import track_first_payment
            asyncio.create_task(track_first_payment(topup.user_id, topup.influencer_id, topup.cents))
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        log.exception("payment_webhook: failed to credit wallet for checkout_id=%s", payload.checkout_id)
        raise HTTPException(status_code=500, detail="Internal error processing payment")

    log.info(
        "payment_webhook: credited user=%s influencer=%s cents=%s balance=%s checkout_id=%s",
        topup.user_id, topup.influencer_id, topup.cents, new_balance, payload.checkout_id,
    )

    # ── 6. FirstPromoter tracking ───────────────────────────────────
    if not topup.fp_tracked:
        if not influencer:
            log.warning("FP tracking skipped: influencer %s not found for checkout_id=%s", topup.influencer_id, payload.checkout_id)
        elif not influencer.fp_ref_id:
            log.warning("FP tracking skipped: influencer %s has no fp_ref_id", topup.influencer_id)
        else:
            try:
                await fp_track_sale_v2(
                    email=user.email,
                    uid=str(user.id),
                    amount_cents=topup.cents,
                    event_id=payload.checkout_id,
                    ref_id=influencer.fp_ref_id,
                    plan="wallet_topup",
                )
                topup.fp_tracked = True
                db.add(topup)
                await db.commit()
                log.info("FP sale tracked for checkout_id=%s ref_id=%s amount=%s", payload.checkout_id, influencer.fp_ref_id, topup.cents)
            except Exception as e:
                log.warning("FP track sale failed for checkout_id=%s: %s", payload.checkout_id, e)

    return {
        "ok": True,
        "user_id": topup.user_id,
        "influencer_id": topup.influencer_id,
        "credited_cents": topup.cents,
        "new_balance_cents": new_balance,
    }
