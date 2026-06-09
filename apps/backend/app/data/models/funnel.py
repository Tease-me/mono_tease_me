"""Telegram funnel event model for attribution and analytics."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class TelegramFunnelEvent(Base):
    """Records each step a Telegram user takes through the conversion funnel.

    Used to build attribution reports and per-influencer conversion rates.
    Events are append-only — nothing is ever updated or deleted.
    """

    __tablename__ = "telegram_funnel_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    influencer_id: Mapped[str] = mapped_column(
        String, ForeignKey("influencers.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    invite_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_tgfe_tg_user_influencer", "telegram_user_id", "influencer_id"),
        Index("ix_tgfe_influencer_event_time", "influencer_id", "event_type", "occurred_at"),
        Index("ix_tgfe_event_type_time", "event_type", "occurred_at"),
        Index("ix_tgfe_user_id", "user_id"),
    )
