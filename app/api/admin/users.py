from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.db.models import User
from app.db.session import get_db
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-users"])


@router.get(
    "/users",
    summary="List users",
    description="Return admin user search results filtered by email, username, or full name.",
)
async def list_users(
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    stmt = select(User)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (User.email.ilike(like))
            | (User.username.ilike(like))
            | (User.full_name.ilike(like))
        )
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "full_name": u.full_name}
        for u in users
    ]
