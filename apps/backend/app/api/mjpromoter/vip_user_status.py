"""Alias routes expected by MJ Promoter (`vip-user-status`)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.api.mjpromoter.vip_invites import _status_item_for_user
from app.core.session import get_db
from app.data.schemas.mjpromoter import MJVipInviteStatusItem
from app.services.repositories.user_repository import get_users_by_ids

router = APIRouter()


@router.get("/{user_id}", response_model=MJVipInviteStatusItem)
async def get_vip_user_status(
    user_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    users = await get_users_by_ids(db, [user_id])
    if not users:
        raise HTTPException(status_code=404, detail="VIP invite user not found")
    return _status_item_for_user(users[0])
