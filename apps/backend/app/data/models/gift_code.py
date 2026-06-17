"""First-deposit gift / promo code models."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class GiftCode(Base):
    """Promo code granted on a user's first deposit with a specific influencer."""

    __tablename__ = "gift_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    diamonds: Mapped[int] = mapped_column(Integer, nullable=False, default=120)

    # pending | sent | accepted | expired
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    redeemed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "influencer_id",
            name="uq_gift_codes_user_influencer",
        ),
        Index("ix_gift_codes_status", "status"),
    )
