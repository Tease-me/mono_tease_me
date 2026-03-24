
import hmac
import logging
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User, PayPalTopUp, Influencer
from app.db.session import get_db
from app.schemas.checkout import PaymentWebhookPayload
from app.schemas.armloop import ArmloopWebhookPayload, ArmloopSessionResponse
from app.services.billing import topup_wallet
from app.services.firstpromoter import fp_track_sale_v2
from app.gateways import armloop_gateway
from app.utils.auth.dependencies import get_current_user
from app.utils.infrastructure.rate_limiter import rate_limit

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


# ══════════════════════════════════════════════════════════════════════
# Armloop Payment Integration
# ══════════════════════════════════════════════════════════════════════


class ArmloopCheckoutRequest(BaseModel):
    """Request to create Armloop checkout session."""
    influencer_id: str
    amount_cents: int
    return_url: str | None = None


@router.post("/armloop/session", response_model=ArmloopSessionResponse)
@rate_limit(max_requests=settings.RATE_LIMIT_BILLING_MAX, window_seconds=settings.RATE_LIMIT_BILLING_WINDOW, key_prefix="armloop:session")
async def create_armloop_session(
    request: Request,
    body: ArmloopCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create Armloop payment session for wallet top-up.
    
    Creates a hosted checkout session and stores pending payment record.
    User will be redirected to Armloop's checkout page to complete payment.
    """
    if body.amount_cents <= 0:
        raise HTTPException(400, "Amount must be positive")

    influencer = await db.get(Influencer, body.influencer_id)
    if not influencer:
        raise HTTPException(404, "Influencer not found")

    # Generate unique transaction ID
    import uuid
    transaction_id = f"topup_{current_user.id}_{uuid.uuid4().hex[:12]}"
    
    # Create payment session via Armloop
    session_data = await armloop_gateway.create_payment_session(
        transaction_id=transaction_id,
        amount_cents=body.amount_cents,
        return_url=body.return_url,
        mode="hosted",
    )
    
    # Store pending payment record
    topup = PayPalTopUp(
        user_id=current_user.id,
        influencer_id=body.influencer_id,
        order_id=transaction_id,
        cents=body.amount_cents,
        provider="armloop",
        status="CREATED",
        credited=False,
    )
    db.add(topup)
    await db.commit()
    
    log.info(
        "armloop.session_created user=%s influencer=%s amount=%d transaction_id=%s",
        current_user.id, body.influencer_id, body.amount_cents, transaction_id,
    )
    
    return ArmloopSessionResponse(**session_data)


@router.post("/armloop/webhook")
async def armloop_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
):
    """Handle Armloop AUTHORISATION webhook notifications.
    
    Armloop sends payment completion notifications via webhook.
    Verifies HMAC signature and credits user wallet upon successful payment.
    """
    # ── 1. Read raw body & verify HMAC ──────────────────────────────
    raw_body = await request.body()
    
    if not x_signature:
        log.warning("armloop.webhook missing X-Signature header")
        raise HTTPException(401, "Missing X-Signature header")
    
    if not armloop_gateway.verify_webhook_signature(raw_body, x_signature):
        log.error("armloop.webhook invalid signature")
        raise HTTPException(401, "Invalid webhook signature")
    
    # ── 2. Parse & validate payload ─────────────────────────────────
    try:
        payload = ArmloopWebhookPayload.model_validate_json(raw_body)
    except Exception as exc:
        log.warning("armloop.webhook payload validation failed: %s", exc)
        raise HTTPException(422, "Invalid payload") from exc
    
    # Process each notification item
    for item in payload.notificationItems:
        notification = item.NotificationRequestItem
        
        # Only process AUTHORISATION events
        if notification.eventCode != "AUTHORISATION":
            log.info("armloop.webhook ignoring event: %s", notification.eventCode)
            continue
        
        # Check if payment was successful
        if notification.success != "true":
            log.warning(
                "armloop.webhook payment failed: ref=%s reason=%s",
                notification.merchantReference, notification.reason
            )
            continue
        
        # ── 3. Look up our local checkout record ────────────────────
        topup = await db.scalar(
            select(PayPalTopUp).where(PayPalTopUp.order_id == notification.merchantReference)
        )
        if not topup:
            log.error(
                "armloop.webhook no PayPalTopUp for merchantReference=%s — skipping",
                notification.merchantReference
            )
            continue
        
        if topup.credited:
            log.info(
                "armloop.webhook duplicate for ref=%s — already processed",
                notification.merchantReference
            )
            continue

        # ── 3b. Cross-check amount against our record ───────────────
        if notification.amount.value != topup.cents:
            log.error(
                "armloop.webhook amount mismatch for ref=%s: "
                "expected %d cents, got %d %s — skipping to prevent mis-crediting",
                notification.merchantReference,
                topup.cents,
                notification.amount.value, notification.amount.currency,
            )
            continue

        # ── 4. Resolve user & influencer from our DB ────────────────
        user = await db.get(User, topup.user_id)
        if not user:
            raise HTTPException(404, "User not found")
        
        influencer = await db.get(Influencer, topup.influencer_id)
        
        source = f"armloop:{notification.pspReference}"
        
        # ── 5. Credit the wallet ────────────────────────────────────
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
        except HTTPException:
            await db.rollback()
            raise
        except Exception:
            await db.rollback()
            log.exception(
                "armloop.webhook failed to credit wallet for ref=%s",
                notification.merchantReference
            )
            raise HTTPException(500, "Internal error processing payment")
        
        log.info(
            "armloop.webhook credited user=%s influencer=%s cents=%s balance=%s ref=%s",
            topup.user_id, topup.influencer_id, topup.cents, new_balance,
            notification.merchantReference,
        )
        
        # ── 6. FirstPromoter tracking ───────────────────────────────
        if not topup.fp_tracked:
            if not influencer:
                log.warning(
                    "FP tracking skipped: influencer %s not found for ref=%s",
                    topup.influencer_id, notification.merchantReference
                )
            elif not influencer.fp_ref_id:
                log.warning(
                    "FP tracking skipped: influencer %s has no fp_ref_id",
                    topup.influencer_id
                )
            else:
                try:
                    await fp_track_sale_v2(
                        email=user.email,
                        uid=str(user.id),
                        amount_cents=topup.cents,
                        event_id=notification.merchantReference,
                        ref_id=influencer.fp_ref_id,
                        plan="wallet_topup",
                    )
                    topup.fp_tracked = True
                    db.add(topup)
                    await db.commit()
                    log.info(
                        "FP sale tracked for ref=%s ref_id=%s amount=%s",
                        notification.merchantReference, influencer.fp_ref_id, topup.cents
                    )
                except Exception as e:
                    log.warning(
                        "FP track sale failed for ref=%s: %s",
                        notification.merchantReference, e
                    )
    
    return {"ok": True, "accepted": True}
