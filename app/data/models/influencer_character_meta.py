"""Influencer-specific adult character metadata overlays."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class InfluencerCharacterMeta(Base):
    """Overlay metadata for a specific influencer and adult character pair."""

    __tablename__ = "influencer_character_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        nullable=False,
    )
    character_id: Mapped[int] = mapped_column(
        ForeignKey("adult_characters.id", ondelete="CASCADE"),
        nullable=False,
    )
    meta_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
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
        UniqueConstraint(
            "influencer_id",
            "character_id",
            name="uq_influencer_character_meta_pair",
        ),
        Index("ix_influencer_character_meta_influencer_id", "influencer_id"),
        Index("ix_influencer_character_meta_character_id", "character_id"),
        Index("ix_influencer_character_meta_is_active", "is_active"),
    )
