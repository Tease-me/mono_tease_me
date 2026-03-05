"""External checkout service via tmservice.live.

Creates payment sessions and verifies their status. Uses the ASCII
Vigenère cipher to obfuscate the user's password hash before sending
it to the external service.

Checkout state is stored in ``InfluencerSubscriptionPayment`` with
``kind='checkout'``.  The ``provider_payload`` JSON column holds the
extra checkout metadata (payment_url, purpose, plan_id, etc.).
"""

import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    InfluencerSubscription,
    InfluencerSubscriptionPayment,
    InfluencerSubscriptionPlan,
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
    purpose: str,
    provider: str,
    plan_id: int | None = None,
    amount_cents: int | None = None,
) -> InfluencerSubscriptionPayment:
    """
    Call tmservice to create an external checkout session.

    Stores the checkout as an ``InfluencerSubscriptionPayment``
    with ``kind='checkout'`` and ``status='pending'``.

    Returns the payment record (provider_payload contains payment_url).
    """

    # ── Resolve amount ────────────────────────────────────────────
    if purpose in ("subscription", "addon"):
        if not plan_id:
            raise HTTPException(400, "plan_id is required for subscription/addon")
        plan = await db.get(InfluencerSubscriptionPlan, plan_id)
        if not plan or not plan.is_active:
            raise HTTPException(404, "Plan not found or inactive")
        resolved_amount = plan.price_cents
    elif purpose == "topup":
        if not amount_cents or amount_cents <= 0:
            raise HTTPException(400, "amount_cents is required for topup")
        resolved_amount = amount_cents
    else:
        raise HTTPException(400, f"Unknown checkout purpose: {purpose}")

    # ── Resolve subscription (required for the payment record FK) ─
    sub = await db.scalar(
        select(InfluencerSubscription).where(
            InfluencerSubscription.user_id == user.id,
            InfluencerSubscription.influencer_id == influencer_id,
        )
    )
    if not sub:
        raise HTTPException(
            400,
            "No subscription found for this influencer. "
            "Start a subscription first via POST /subscriptions/start.",
        )

    # ── Build password ────────────────────────────────────────────
    ciphered_password = _cipher_password(user.password_hash or "")

    # ── Call tmservice ────────────────────────────────────────────
    payload = {
        "userEmail": user.email,
        "password": ciphered_password,
        "amount": resolved_amount,
        "slug": influencer_id,
        "payment_provider": provider,
        "redirection": settings.TMSERVICE_REDIRECT_URL,
    }

    log.info(
        "checkout.create user=%s provider=%s amount=%d purpose=%s",
        user.id, provider, resolved_amount, purpose,
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
        "purpose": purpose,
        "plan_id": plan_id,
    }
    # Provider-specific data
    if provider == "stripe":
        provider_payload["session_id"] = data.get("session_id")
    elif provider == "paypal":
        provider_payload["order_id"] = data.get("order_id")

    payment = InfluencerSubscriptionPayment(
        subscription_id=sub.id,
        user_id=user.id,
        influencer_id=influencer_id,
        amount_cents=resolved_amount,
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
        payment.id, checkout_id, provider, resolved_amount,
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


# ── Fulfilment helpers ───────────────────────────────────────────────


async def _fulfil_subscription(
    db: AsyncSession,
    payment: InfluencerSubscriptionPayment,
    user: User,
) -> InfluencerSubscription:
    """Activate a subscription after successful payment."""
    from datetime import timedelta

    from app.services.billing import topup_wallet
    from app.services.firstpromoter import fp_track_sale_v2

    now = datetime.now(timezone.utc)
    pp = payment.provider_payload or {}
    plan_id = pp.get("plan_id")

    sub = await db.scalar(
        select(InfluencerSubscription).where(
            InfluencerSubscription.user_id == user.id,
            InfluencerSubscription.influencer_id == payment.influencer_id,
        )
    )

    plan = await db.get(InfluencerSubscriptionPlan, plan_id) if plan_id else None

    if not sub:
        sub = InfluencerSubscription(
            user_id=user.id,
            influencer_id=payment.influencer_id,
            plan_id=plan_id,
            price_cents=payment.amount_cents,
            is_18_selected=True,
            status="active",
            started_at=now,
        )
        db.add(sub)
        await db.flush()

    # Activate and set period
    sub.status = "active"
    sub.plan_id = plan_id
    sub.price_cents = payment.amount_cents
    sub.provider = payment.provider
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30)
    sub.last_payment_at = now
    sub.next_payment_at = now + timedelta(days=30)
    db.add(sub)

    # Credit wallet with subscription credits
    credits = payment.amount_cents
    if plan and plan.features and "credits_per_month" in plan.features:
        credits = plan.features["credits_per_month"]

    await topup_wallet(
        db,
        user_id=user.id,
        influencer_id=payment.influencer_id,
        cents=credits,
        source=f"subscription:{payment.provider}",
        is_18=True,
    )

    await db.commit()
    await db.refresh(sub)

    # FirstPromoter tracking (fire-and-forget)
    try:
        from app.db.models import Influencer
        influencer = await db.get(Influencer, payment.influencer_id)
        if influencer and influencer.fp_ref_id:
            await fp_track_sale_v2(
                email=user.email,
                uid=str(user.id),
                amount_cents=payment.amount_cents,
                event_id=payment.provider_event_id,
                ref_id=influencer.fp_ref_id,
                plan="subscription",
            )
    except Exception:
        log.warning("FirstPromoter track failed for checkout=%s", payment.provider_event_id)

    log.info(
        "checkout.fulfil_subscription sub=%s user=%s infl=%s",
        sub.id, user.id, payment.influencer_id,
    )
    return sub


async def _fulfil_addon(
    db: AsyncSession,
    payment: InfluencerSubscriptionPayment,
    user: User,
) -> dict:
    """Credit an add-on pack to the user's wallet after successful payment."""
    from app.db.models import (
        InfluencerSubscriptionAddonPurchase,
    )
    from app.services.billing import topup_wallet
    from app.services.firstpromoter import fp_track_sale_v2

    now = datetime.now(timezone.utc)
    pp = payment.provider_payload or {}
    plan_id = pp.get("plan_id")

    plan = await db.get(InfluencerSubscriptionPlan, plan_id) if plan_id else None
    if not plan:
        raise HTTPException(400, "Add-on plan not found")

    credits_to_add = plan.price_cents
    if plan.features and "credits_granted" in plan.features:
        credits_to_add = plan.features["credits_granted"]

    sub = await db.scalar(
        select(InfluencerSubscription).where(
            InfluencerSubscription.user_id == user.id,
            InfluencerSubscription.influencer_id == payment.influencer_id,
            InfluencerSubscription.status == "active",
        )
    )
    if not sub:
        raise HTTPException(400, "Active subscription required for add-on fulfilment")

    # Credit wallet
    new_balance = await topup_wallet(
        db,
        user_id=user.id,
        influencer_id=payment.influencer_id,
        cents=credits_to_add,
        source=f"addon:{payment.provider}",
        is_18=True,
    )

    # Record addon purchase
    transaction_id = f"checkout_{payment.provider_event_id}"
    addon_purchase = InfluencerSubscriptionAddonPurchase(
        subscription_id=sub.id,
        user_id=user.id,
        influencer_id=payment.influencer_id,
        plan_id=plan.id,
        amount_paid_cents=payment.amount_cents,
        credits_granted=credits_to_add,
        currency=plan.currency,
        provider=payment.provider,
        provider_transaction_id=transaction_id,
        purchased_at=now,
    )
    db.add(addon_purchase)

    await db.commit()
    await db.refresh(addon_purchase)

    # FirstPromoter tracking (fire-and-forget)
    try:
        from app.db.models import Influencer
        influencer = await db.get(Influencer, payment.influencer_id)
        if influencer and influencer.fp_ref_id:
            await fp_track_sale_v2(
                email=user.email,
                uid=str(user.id),
                amount_cents=payment.amount_cents,
                event_id=transaction_id,
                ref_id=influencer.fp_ref_id,
                plan="addon",
            )
    except Exception:
        log.warning("FirstPromoter track failed for addon checkout=%s", payment.provider_event_id)

    log.info(
        "checkout.fulfil_addon purchase=%s user=%s infl=%s credits=%d",
        addon_purchase.id, user.id, payment.influencer_id, credits_to_add,
    )

    return {
        "purchase_id": addon_purchase.id,
        "addon_name": plan.plan_name,
        "credits_added": credits_to_add,
        "new_balance": new_balance,
    }
