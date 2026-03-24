"""Influencer deletion helpers including chat history cleanup."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.turn_handler import redis_history
from app.data.models import CallRecord, Chat, Chat18, Influencer, Memory, Message, Message18

log = logging.getLogger(__name__)


class InfluencerDeleteNotFoundError(Exception):
    """Raised when influencer does not exist."""


class InfluencerDeleteError(Exception):
    """Raised when influencer cleanup/delete fails."""


@dataclass(slots=True)
class InfluencerDeleteResult:
    ok: bool
    influencer_id: str
    messages_deleted: int
    messages_18_deleted: int
    memories_deleted: int
    call_records_deleted: int
    chats_deleted: int
    chats_18_deleted: int
    redis_keys_cleared: list[str]
    redis_clear_failures: list[str]

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "influencer_id": self.influencer_id,
            "messages_deleted": self.messages_deleted,
            "messages_18_deleted": self.messages_18_deleted,
            "memories_deleted": self.memories_deleted,
            "call_records_deleted": self.call_records_deleted,
            "chats_deleted": self.chats_deleted,
            "chats_18_deleted": self.chats_18_deleted,
            "redis_keys_cleared": self.redis_keys_cleared,
            "redis_clear_failures": self.redis_clear_failures,
        }


async def delete_influencer_and_chat_history(
    db: AsyncSession,
    *,
    influencer_id: str,
) -> InfluencerDeleteResult:
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise InfluencerDeleteNotFoundError("Influencer not found")

    normal_chat_ids_result = await db.execute(
        select(Chat.id).where(Chat.influencer_id == influencer_id)
    )
    normal_chat_ids = list(normal_chat_ids_result.scalars().all())

    adult_chat_ids_result = await db.execute(
        select(Chat18.id).where(Chat18.influencer_id == influencer_id)
    )
    adult_chat_ids = list(adult_chat_ids_result.scalars().all())

    deleted_message_ids: list[int] = []
    deleted_message_18_ids: list[int] = []
    deleted_memory_ids: list[int] = []
    deleted_call_ids: list[str] = []
    deleted_chat_ids: list[str] = []
    deleted_chat_18_ids: list[str] = []

    try:
        if normal_chat_ids:
            deleted_message_ids = list(
                (
                    await db.execute(
                        delete(Message)
                        .where(Message.chat_id.in_(normal_chat_ids))
                        .returning(Message.id)
                    )
                )
                .scalars()
                .all()
            )
            deleted_memory_ids = list(
                (
                    await db.execute(
                        delete(Memory)
                        .where(Memory.chat_id.in_(normal_chat_ids))
                        .returning(Memory.id)
                    )
                )
                .scalars()
                .all()
            )

        call_filter = [CallRecord.influencer_id == influencer_id]
        if normal_chat_ids:
            call_filter.append(CallRecord.chat_id.in_(normal_chat_ids))
        deleted_call_ids = list(
            (
                await db.execute(
                    delete(CallRecord)
                    .where(or_(*call_filter))
                    .returning(CallRecord.conversation_id)
                )
            )
            .scalars()
            .all()
        )

        if adult_chat_ids:
            deleted_message_18_ids = list(
                (
                    await db.execute(
                        delete(Message18)
                        .where(Message18.chat_id.in_(adult_chat_ids))
                        .returning(Message18.id)
                    )
                )
                .scalars()
                .all()
            )

        if normal_chat_ids:
            deleted_chat_ids = list(
                (
                    await db.execute(
                        delete(Chat)
                        .where(Chat.id.in_(normal_chat_ids))
                        .returning(Chat.id)
                    )
                )
                .scalars()
                .all()
            )

        if adult_chat_ids:
            deleted_chat_18_ids = list(
                (
                    await db.execute(
                        delete(Chat18)
                        .where(Chat18.id.in_(adult_chat_ids))
                        .returning(Chat18.id)
                    )
                )
                .scalars()
                .all()
            )

        await db.delete(influencer)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        log.error(
            "delete_influencer_and_chat_history_failed influencer_id=%s",
            influencer_id,
            exc_info=True,
        )
        raise InfluencerDeleteError("Failed to delete influencer and chat history") from exc

    redis_clear_failures: list[str] = []
    redis_keys_cleared: list[str] = []
    for key in sorted(set(normal_chat_ids + adult_chat_ids)):
        try:
            redis_history(key).clear()
            redis_keys_cleared.append(key)
        except Exception:
            redis_clear_failures.append(key)
            log.warning("[REDIS] Failed to clear history for chat %s", key, exc_info=True)

    return InfluencerDeleteResult(
        ok=True,
        influencer_id=influencer_id,
        messages_deleted=len(deleted_message_ids),
        messages_18_deleted=len(deleted_message_18_ids),
        memories_deleted=len(deleted_memory_ids),
        call_records_deleted=len(deleted_call_ids),
        chats_deleted=len(deleted_chat_ids),
        chats_18_deleted=len(deleted_chat_18_ids),
        redis_keys_cleared=redis_keys_cleared,
        redis_clear_failures=redis_clear_failures,
    )

