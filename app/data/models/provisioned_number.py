"""Provisioned phone number model — tracks Twilio numbers and their Telegram sessions."""

from datetime import datetime, timezone

from sqlalchemy import (
    Integer, BigInteger, String, Boolean, Text, Enum,
    ForeignKey, DateTime, Index,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from app.data.enums.telegram_session_status import TelegramSessionStatus


class ProvisionedNumber(Base):
    """A Twilio-purchased phone number and its Telegram activation status."""

    __tablename__ = "provisioned_number"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    phone_number: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True,
        comment="E.164 phone number (e.g. +14155551234)",
    )

    twilio_sid: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True,
        comment="Twilio IncomingPhoneNumber SID (PNxxx)",
    )

    country_code: Mapped[str] = mapped_column(
        String(4), nullable=False,
        comment="ISO 2-letter country code",
    )

    influencer_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("influencers.id", ondelete="SET NULL"),
        nullable=True,
        comment="Linked influencer (optional)",
    )

    telegram_session_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TelegramSessionStatus.PENDING,
        comment="pending | code_sent | verified | failed",
    )

    telegram_user_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
        comment="Telegram user ID once account is verified",
    )

    telegram_username: Mapped[str | None] = mapped_column(
        String(128), nullable=True,
        comment="Telegram username if set",
    )

    telegram_first_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True, default="User",
        comment="First name used during Telegram sign-up (e.g. Instagram handle)",
    )

    telegram_last_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True,
        comment="Last name used during Telegram sign-up",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Active toggle",
    )

    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Last error message if status=failed",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_prov_num_status", "telegram_session_status"),
        Index("ix_prov_num_influencer", "influencer_id"),
    )
