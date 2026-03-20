"""Telegram invite code model for binding Telegram users to web accounts."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class TelegramInvite(Base):
    """Maps a unique invite code to a Telegram user + influencer pair.

    Created when a Telegram user exhausts their free trial and receives
    a signup link. Claimed when the user completes registration via the link.
    """

    __tablename__ = "telegram_invite"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    influencer_id: Mapped[str] = mapped_column(
        String, ForeignKey("influencers.id", ondelete="CASCADE"), nullable=False
    )
    claimed_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    claimed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
