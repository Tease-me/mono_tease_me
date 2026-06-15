"""MJFP-facing gift code endpoints — internal token auth only."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.data.schemas.gift_code import (
    GiftActivityItem,
    GiftActivityResponse,
    SendGiftCodeResponse,
)
from app.services.repositories import gift_code_repository as repo

router = APIRouter(prefix="/gift-codes")


@router.get("/activity", response_model=GiftActivityResponse)
async def get_gift_activity(
    influencer_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
) -> GiftActivityResponse:
    items = await repo.get_activity_list(db, influencer_id=influencer_id, search=search)
    pending_count = await repo.count_pending(db, influencer_id=influencer_id)
    return GiftActivityResponse(
        items=[GiftActivityItem(**item) for item in items],
        pending_count=pending_count,
    )


@router.post("/{user_id}/send", response_model=SendGiftCodeResponse)
async def send_gift_code(
    user_id: int,
    influencer_id: str = Query(..., min_length=1),
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
) -> SendGiftCodeResponse:
    gift = await repo.get_by_user_and_influencer(db, user_id, influencer_id)
    if not gift:
        raise HTTPException(
            status_code=404,
            detail="No gift code for this user and influencer",
        )

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
        ok=True,
        code=gift.code,
        status=gift.status,
        diamonds=gift.diamonds,
        expires_at=gift.expires_at,
    )
