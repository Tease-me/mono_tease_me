"""MJ Promoter gifted promo code redemption."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session import get_db
from app.data.models import User
from app.data.schemas.mjp_promo_code import (
    RedeemMjpPromoCodeRequest,
    RedeemMjpPromoCodeResponse,
)
from app.services.use_cases.redeem_mjp_promo_code import redeem_mjp_promo_code
from app.utils.auth.dependencies import get_current_user
from app.utils.infrastructure.rate_limiter import rate_limit

router = APIRouter(prefix="/promo-codes", tags=["Promo Codes"])


@router.post("/redeem", response_model=RedeemMjpPromoCodeResponse)
@rate_limit(
    max_requests=settings.RATE_LIMIT_BILLING_MAX,
    window_seconds=settings.RATE_LIMIT_BILLING_WINDOW,
    key_prefix="promo:redeem",
)
async def redeem_promo_code(
    request: Request,
    body: RedeemMjpPromoCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await redeem_mjp_promo_code(
        db,
        user=current_user,
        promo_code=body.promo_code,
        influencer_id=body.influencer_id,
    )
    return RedeemMjpPromoCodeResponse(**result)
