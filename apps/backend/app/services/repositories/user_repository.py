"""User repository — DB access only.

All persistence operations for the User model live here.
Business decisions belong in the service layer.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import User
from app.utils.vip_invite_code import normalize_vip_invite_code

log = logging.getLogger(__name__)


async def get_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    """Fetch a user by email address."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_users_by_ids(
    db: AsyncSession,
    user_ids: list[int],
) -> list[User]:
    if not user_ids:
        return []
    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    return list(result.scalars().all())


async def get_users_by_invite_codes(
    db: AsyncSession,
    invite_codes: list[str],
) -> list[User]:
    normalized_codes = [
        normalize_vip_invite_code(code)
        for code in invite_codes
        if isinstance(code, str) and code.strip()
    ]
    if not normalized_codes:
        return []
    result = await db.execute(
        select(User).where(
            func.upper(User.email_token).in_(normalized_codes)
            | func.upper(User.vip_invite_code).in_(normalized_codes)
        )
    )
    return list(result.scalars().all())


async def get_by_email_token(
    db: AsyncSession,
    token: str,
) -> User | None:
    """Fetch a user by email verification token or VIP invite code."""
    normalized = normalize_vip_invite_code(token)
    result = await db.execute(
        select(User).where(
            (User.email_token == token)
            | (func.upper(User.email_token) == normalized)
        )
    )
    return result.scalar_one_or_none()


async def bind_telegram_id(
    db: AsyncSession,
    user: User,
    telegram_id: int,
) -> bool:
    """Bind telegram_id to a user and commit.

    Returns True if the bind was performed or was already correct,
    False if the bind was refused.

    Safety checks:
    - Idempotent if the user already has the same telegram_id.
    - Refuses to overwrite an existing *different* telegram_id.
    - Refuses to bind if another user already owns this telegram_id.
    """
    # Idempotent — already bound to this telegram_id
    if user.telegram_id == telegram_id:
        return True

    # Already bound to a different telegram_id — don't overwrite
    if user.telegram_id is not None:
        log.warning(
            "bind_telegram_id.skip user=%s already has telegram_id=%s, refusing to overwrite with %s",
            user.id, user.telegram_id, telegram_id,
        )
        return False

    # Check if another user already has this telegram_id
    result = await db.execute(
        select(User.id).where(User.telegram_id == telegram_id).limit(1)
    )
    existing_user_id = result.scalar_one_or_none()
    if existing_user_id:
        log.warning(
            "bind_telegram_id.skip telegram_id=%s already bound to user=%s, cannot bind to user=%s",
            telegram_id, existing_user_id, user.id,
        )
        return False

    user.telegram_id = telegram_id
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return True
