"""User repository — DB access only.

All persistence operations for the User model live here.
Business decisions belong in the service layer.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User

log = logging.getLogger(__name__)


async def bind_telegram_id(
    db: AsyncSession,
    user: User,
    telegram_id: int,
) -> User:
    """Set the telegram_id on a user and commit."""
    user.telegram_id = telegram_id
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
