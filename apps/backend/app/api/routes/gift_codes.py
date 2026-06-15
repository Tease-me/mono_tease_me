"""First-deposit gift code routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.core.session import get_db
from app.data.models import GiftCode, User
from app.data.schemas.gift_code import (
    GiftActivityItem,
    GiftActivityResponse,
    PendingGiftCountResponse,
    RedeemGiftCodeRequest,
    RedeemGiftCodeResponse,
    SendGiftCodeResponse,
)
from app.services.repositories import gift_code_repository as repo
from app.services.use_cases.redeem_gift_code import redeem_gift_code
from app.utils.auth.dependencies import get_current_user

router = APIRouter(prefix="/gift-codes", tags=["Gift Codes"])


async def _get_gift_for_user(
    db: AsyncSession,
    user_id: int,
    influencer_id: str,
) -> GiftCode:
    gift = await repo.get_by_user_and_influencer(db, user_id, influencer_id)
    if not gift:
        raise HTTPException(status_code=404, detail="No gift code for this user and influencer")
    return gift


@router.get("/activity", response_model=GiftActivityResponse)
async def get_gift_activity(
    search: str | None = Query(default=None),
    influencer_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    items = await repo.get_activity_list(db, influencer_id=influencer_id, search=search)
    pending_count = await repo.count_pending(db, influencer_id=influencer_id)
    return GiftActivityResponse(
        items=[GiftActivityItem(**item) for item in items],
        pending_count=pending_count,
    )


@router.get("/pending-count", response_model=PendingGiftCountResponse)
async def get_pending_gift_count(
    influencer_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    pending_count = await repo.count_pending(db, influencer_id=influencer_id)
    return PendingGiftCountResponse(pending_count=pending_count)


@router.post("/redeem", response_model=RedeemGiftCodeResponse)
async def redeem_code(
    body: RedeemGiftCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await redeem_gift_code(db, user=current_user, code=body.code)
    return RedeemGiftCodeResponse(**result)


@router.post("/{user_id}/send", response_model=SendGiftCodeResponse)
async def send_gift_code(
    user_id: int,
    influencer_id: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    gift = await _get_gift_for_user(db, user_id, influencer_id)

    now = datetime.now(timezone.utc)
    if gift.expires_at < now and gift.status in ("pending", "sent"):
        await repo.mark_expired(db, gift)
        await db.commit()
        raise HTTPException(status_code=410, detail="Gift code has expired")

    if gift.status == "accepted":
        raise HTTPException(status_code=409, detail="Gift already redeemed")
    if gift.status == "expired":
        raise HTTPException(status_code=410, detail="Gift code has expired")

    if gift.status == "pending":
        gift = await repo.mark_sent(db, gift)
        await db.commit()

    return SendGiftCodeResponse(
        code=gift.code,
        status=gift.status,
        diamonds=gift.diamonds,
        expires_at=gift.expires_at,
    )
