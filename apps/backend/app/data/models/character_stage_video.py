"""Stage video variants for adult character scenario galleries."""

from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CharacterStageVideo(Base):
    """One video variant within a conversation stage for an influencer + character."""

    __tablename__ = "character_stage_videos"

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
    variant_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    mp4_key: Mapped[str | None] = mapped_column(String, nullable=True)
    webm_key: Mapped[str | None] = mapped_column(String, nullable=True)
    poster_key: Mapped[str | None] = mapped_column(String, nullable=True)
    stage_context_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
    )
    scene_description_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
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
            "stage_index",
            "variant_index",
            name="uq_character_stage_video_slot",
        ),
    )
