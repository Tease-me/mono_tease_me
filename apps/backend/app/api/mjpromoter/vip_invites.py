from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.data.schemas.mjpromoter import (
    MJVipInviteStatusItem,
    MJVipInviteStatusRequest,
    MJVipInviteStatusResponse,
)
from app.services.repositories.user_repository import (
    get_users_by_ids,
    get_users_by_invite_codes,
)
from app.services.use_cases.vip_invite_status import build_vip_invite_status_result

router = APIRouter(prefix="/vip-invites")


def _status_item_for_user(user) -> MJVipInviteStatusItem:
    return MJVipInviteStatusItem(**build_vip_invite_status_result(user).as_dict())


@router.get("/{user_id}/status", response_model=MJVipInviteStatusItem)
async def get_vip_invite_status_by_user_id(
    user_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    users = await get_users_by_ids(db, [user_id])
    if not users:
        raise HTTPException(status_code=404, detail="VIP invite user not found")
    return _status_item_for_user(users[0])


@router.post("/status", response_model=MJVipInviteStatusResponse)
async def get_vip_invite_status_internal(
    payload: MJVipInviteStatusRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    users_by_id: dict[int, object] = {}
    if payload.user_ids:
        for user in await get_users_by_ids(db, payload.user_ids):
            users_by_id[user.id] = user
    if payload.invite_codes:
        for user in await get_users_by_invite_codes(db, payload.invite_codes):
            users_by_id[user.id] = user

    items = [_status_item_for_user(user) for user in users_by_id.values()]
    return MJVipInviteStatusResponse(items=items)
