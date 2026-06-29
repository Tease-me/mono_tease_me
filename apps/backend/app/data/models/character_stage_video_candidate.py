"""Grok-generated gallery candidates pending admin review."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CharacterStageVideoCandidate(Base):
    """A Grok-generated variation awaiting approve/reject."""

    __tablename__ = "character_stage_video_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        nullable=False,
    )
    character_id: Mapped[int] = mapped_column(
        ForeignKey("adult_characters.id", ondelete="CASCADE"),
        nullable=False,
    )
    stage_index: Mapped[int] = mapped_column(Integer, nullable=False)
    source_image_key: Mapped[str] = mapped_column(String, nullable=False)
    generation_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_review")
    generated_poster_key: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_mp4_key: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_variant_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    grok_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
