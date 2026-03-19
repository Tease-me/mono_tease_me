from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import InfluencerWallet, Influencer
from app.repositories.billing_repository import get_wallet_balance_cents
from app.schemas.billing import (
    TopUpRequest,
    CreateCheckoutRequest,
    CheckoutResponse,
    VerifyCheckoutRequest,
)
from app.utils.auth.dependencies import get_current_user
from sqlalchemy import select
from app.core.config import settings
from app.utils.infrastructure.rate_limiter import rate_limit
from app.utils.infrastructure.idempotency import idempotent

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/balance")
async def get_balance(
    influencer_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
                                                                                                                                                                is_18: bool = False,
):
    infl = await db.get(Influencer, influencer_id)
    if not infl:
        raise HTTPException(status_code=404, detail="Influencer not found")

    return {
        "influencer_id": influencer_id,
        "balance_cents": await get_wallet_balance_cents(
            db,
            user_id=user.id,
            influencer_id=influencer_id,
            is_18=is_18,
        ),
    }

@router.post("/topup")
@rate_limit(max_requests=settings.RATE_LIMIT_BILLING_MAX, window_seconds=settings.RATE_LIMIT_BILLING_WINDOW, key_prefix="billing:topup")
@idempotent(ttl=settings.IDEMPOTENCY_TTL, key_prefix="topup")
async def topup(
    request: Request,
    req: TopUpRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if not req.influencer_id:
        raise HTTPException(status_code=400, detail="Missing influencer_id")

    wallet = await db.scalar(
        select(InfluencerWallet).where(
            InfluencerWallet.user_id == user.id,
            InfluencerWallet.influencer_id == req.influencer_id,
            InfluencerWallet.is_18.is_(False),
        )
    )

    if not wallet:
        wallet = InfluencerWallet(
            user_id=user.id,
            influencer_id=req.influencer_id,
            balance_cents=0,
        )
        db.add(wallet)
        await db.flush()

    wallet.balance_cents = (wallet.balance_cents or 0) + int(req.cents)
    db.add(wallet)

    await db.commit()
    await db.refresh(wallet)

    return {
        "ok": True,
        "user_id": user.id,
        "influencer_id": wallet.influencer_id,
        "balance_cents": wallet.balance_cents,
    }


# ════════════════════════════════════════════════════════════════════
#  EXTERNAL CHECKOUT (tmservice.live)
# ════════════════════════════════════════════════════════════════════


@router.post("/create-checkout", response_model=CheckoutResponse)
@rate_limit(
    max_requests=settings.RATE_LIMIT_BILLING_MAX,
    window_seconds=settings.RATE_LIMIT_BILLING_WINDOW,
    key_prefix="billing:checkout",
)
async def create_checkout(
    request: Request,
    req: CreateCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Create an external checkout session via tmservice.

    Returns a ``payment_url`` that the frontend should open so the
    user can complete payment through Stripe or PayPal.
    """
    from app.services.checkout import create_checkout as _create

    # Validate influencer exists
    infl = await db.get(Influencer, req.influencer_id)
    if not infl:
        raise HTTPException(status_code=404, detail="Influencer not found")

    payment = await _create(
        db,
        user=user,
        influencer_id=req.influencer_id,
        provider=req.provider,
        amount_cents=req.amount_cents,
    )

    return CheckoutResponse(
        checkout_id=payment["checkout_id"],
        payment_url=payment["payment_url"],
        provider=payment["provider"],
        amount_cents=payment["amount_cents"],
    )


@router.post("/verify-checkout")
@rate_limit(
    max_requests=settings.RATE_LIMIT_BILLING_MAX,
    window_seconds=settings.RATE_LIMIT_BILLING_WINDOW,
    key_prefix="billing:verify",
)
async def verify_checkout_endpoint(
    request: Request,
    req: VerifyCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Verify that a checkout has been paid.

    The frontend should call this after the user returns from the
    payment page.  The actual wallet crediting happens securely
    via the webhook.
    """
    from app.services.checkout import verify_checkout as _verify

    status = await _verify(checkout_id=req.checkout_id, user_id=user.id)

    result = {
        "ok": True,
        "checkout_id": req.checkout_id,
        "status": status,
    }

    return result
