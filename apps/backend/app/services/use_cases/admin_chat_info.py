"""Use-case orchestration for admin pair chat info metrics."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.repositories.admin_chat_info_repository import (
    count_adult_chats,
    count_adult_messages,
    count_calls,
    count_normal_chats,
    count_normal_memories,
    count_normal_messages,
)

log = logging.getLogger(__name__)


class AdminChatInfoValidationError(Exception):
    """Raised when admin chat info inputs are invalid."""


class AdminChatInfoError(Exception):
    """Raised when metrics retrieval fails unexpectedly."""


@dataclass(slots=True)
class MetricsGroup:
    chats_count: int
    messages_count: int
    memories_count: int
    calls_count: int

    def as_dict(self) -> dict:
        return {
            "chats_count": self.chats_count,
            "messages_count": self.messages_count,
            "memories_count": self.memories_count,
            "calls_count": self.calls_count,
        }


@dataclass(slots=True)
class AdminChatInfoResult:
    ok: bool
    influencer_id: str
    user_id: int
    from_iso: str | None
    to_iso: str | None
    normal: MetricsGroup
    adult: MetricsGroup
    total: MetricsGroup

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "influencer_id": self.influencer_id,
            "user_id": self.user_id,
            "from": self.from_iso,
            "to": self.to_iso,
            "normal": self.normal.as_dict(),
            "adult": self.adult.as_dict(),
            "total": self.total.as_dict(),
        }


def _validate_range(from_dt: datetime | None, to_dt: datetime | None) -> None:
    if from_dt is not None and to_dt is not None and from_dt > to_dt:
        raise AdminChatInfoValidationError("'from' must be less than or equal to 'to'")


async def get_admin_chat_info(
    db: AsyncSession,
    *,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> AdminChatInfoResult:
    _validate_range(from_dt, to_dt)
    log.info(
        "admin_chat_info_start influencer_id=%s user_id=%s from=%s to=%s",
        influencer_id,
        user_id,
        from_dt.isoformat() if from_dt else None,
        to_dt.isoformat() if to_dt else None,
    )
    try:
        normal_chats = await count_normal_chats(db, influencer_id, user_id, from_dt, to_dt)
        normal_messages = await count_normal_messages(db, influencer_id, user_id, from_dt, to_dt)
        normal_memories = await count_normal_memories(db, influencer_id, user_id, from_dt, to_dt)
        normal_calls = await count_calls(db, influencer_id, user_id, from_dt, to_dt)

        adult_chats = await count_adult_chats(db, influencer_id, user_id, from_dt, to_dt)
        adult_messages = await count_adult_messages(db, influencer_id, user_id, from_dt, to_dt)

        normal = MetricsGroup(
            chats_count=normal_chats,
            messages_count=normal_messages,
            memories_count=normal_memories,
            calls_count=normal_calls,
        )
        adult = MetricsGroup(
            chats_count=adult_chats,
            messages_count=adult_messages,
            memories_count=0,
            calls_count=0,
        )
        total = MetricsGroup(
            chats_count=normal.chats_count + adult.chats_count,
            messages_count=normal.messages_count + adult.messages_count,
            memories_count=normal.memories_count + adult.memories_count,
            calls_count=normal.calls_count + adult.calls_count,
        )

        result = AdminChatInfoResult(
            ok=True,
            influencer_id=influencer_id,
            user_id=user_id,
            from_iso=from_dt.isoformat() if from_dt else None,
            to_iso=to_dt.isoformat() if to_dt else None,
            normal=normal,
            adult=adult,
            total=total,
        )
        log.info(
            "admin_chat_info_done influencer_id=%s user_id=%s normal=%s adult=%s total=%s",
            influencer_id,
            user_id,
            result.normal.as_dict(),
            result.adult.as_dict(),
            result.total.as_dict(),
        )
        return result
    except AdminChatInfoValidationError:
        raise
    except Exception as exc:
        log.error(
            "admin_chat_info_failed influencer_id=%s user_id=%s from=%s to=%s",
            influencer_id,
            user_id,
            from_dt.isoformat() if from_dt else None,
            to_dt.isoformat() if to_dt else None,
            exc_info=True,
        )
        raise AdminChatInfoError("Failed to fetch admin chat info") from exc
