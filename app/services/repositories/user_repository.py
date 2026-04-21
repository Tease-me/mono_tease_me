"""User repository — DB access only.

All persistence operations for the User model live here.
Business decisions belong in the service layer.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import User

log = logging.getLogger(__name__)


async def get_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    """Fetch a user by email address."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_by_email_token(
    db: AsyncSession,
    token: str,
) -> User | None:
    """Fetch a user by email verification token."""
    result = await db.execute(select(User).where(User.email_token == token))
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
