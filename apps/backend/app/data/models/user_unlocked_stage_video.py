"""User-unlocked gallery stage videos from live calls."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class UserUnlockedStageVideo(Base):
    """A gallery stage video the user has seen at least once during a call."""

    __tablename__ = "user_unlocked_stage_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
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
    conversation_id: Mapped[str | None] = mapped_column(String, nullable=True)
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "influencer_id",
            "character_id",
            "stage_index",
            "variant_index",
            name="uq_user_unlocked_stage_video",
        ),
    )
