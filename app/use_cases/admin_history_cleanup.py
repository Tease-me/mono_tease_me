"""Use-case orchestration for admin pair history cleanup."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.turn_handler import redis_history
from app.utils.infrastructure.redis_pool import get_redis
from app.repositories.history_cleanup_repository import (
    delete_calls_by_chat_ids_or_orphans,
    delete_calls_orphans_only,
    delete_chats18_by_ids,
    delete_chats_by_ids,
    delete_memories_by_chat_ids,
    delete_messages18_by_chat_ids,
    delete_messages_by_chat_ids,
    get_adult_chat_ids,
    get_normal_chat_ids,
)

log = logging.getLogger(__name__)

HistoryClearMode = Literal["normal", "adult", "both"]


class AdminHistoryNotFoundError(Exception):
    """Raised when no deletable history exists for the target pair."""


class AdminHistoryClearError(Exception):
    """Raised when history cleanup fails unexpectedly."""


async def clear_elevenlabs_conversation_cache(chat_ids: list[str]) -> dict[str, int | list[str]]:
    """Best-effort invalidation for ElevenLabs conversation cache keys."""
    unique_chat_ids = sorted(set(chat_ids))
    if not unique_chat_ids:
        return {"chat_ids": 0, "keys_attempted": 0, "keys_deleted": 0, "failed_chat_ids": []}

    keys: list[str] = []
    for chat_id in unique_chat_ids:
        keys.extend(
            [
                f"mem_summary:{chat_id}",
                f"ai_mem_summary:{chat_id}",
                f"greeting:{chat_id}",
            ]
        )

    try:
        rclient = await get_redis()
        deleted = await rclient.delete(*keys) if keys else 0
        return {
            "chat_ids": len(unique_chat_ids),
            "keys_attempted": len(keys),
            "keys_deleted": int(deleted or 0),
            "failed_chat_ids": [],
        }
    except Exception:
        log.warning(
            "[REDIS] Failed to clear ElevenLabs conversation cache for chats=%s",
            unique_chat_ids,
            exc_info=True,
        )
        return {
            "chat_ids": len(unique_chat_ids),
            "keys_attempted": len(keys),
            "keys_deleted": 0,
            "failed_chat_ids": unique_chat_ids,
        }


@dataclass(slots=True)
class HistoryCleanupResult:
    ok: bool
    influencer_id: str
    user_id: int
    mode: HistoryClearMode
    chat_ids_targeted: list[str]
    chat_18_ids_targeted: list[str]
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
            "user_id": self.user_id,
            "mode": self.mode,
            "chat_ids_targeted": self.chat_ids_targeted,
            "chat_18_ids_targeted": self.chat_18_ids_targeted,
            "messages_deleted": self.messages_deleted,
            "messages_18_deleted": self.messages_18_deleted,
            "memories_deleted": self.memories_deleted,
            "call_records_deleted": self.call_records_deleted,
            "chats_deleted": self.chats_deleted,
            "chats_18_deleted": self.chats_18_deleted,
            "redis_keys_cleared": self.redis_keys_cleared,
            "redis_clear_failures": self.redis_clear_failures,
        }


async def clear_pair_history(
    db: AsyncSession,
    *,
    influencer_id: str,
    user_id: int,
    mode: HistoryClearMode,
) -> HistoryCleanupResult:
    log.info(
        "admin_history_clear_start influencer_id=%s user_id=%s mode=%s",
        influencer_id,
        user_id,
        mode,
    )

    normal_chat_ids: list[str] = []
    adult_chat_ids: list[str] = []
    deleted_message_ids: list[int] = []
    deleted_message_18_ids: list[int] = []
    deleted_memory_ids: list[int] = []
    deleted_call_ids: list[str] = []
    deleted_chat_ids: list[str] = []
    deleted_chat_18_ids: list[str] = []
    redis_clear_failures: list[str] = []

    include_normal = mode in ("normal", "both")
    include_adult = mode in ("adult", "both")

    try:
        if include_normal:
            normal_chat_ids = await get_normal_chat_ids(db, influencer_id, user_id)
        if include_adult:
            adult_chat_ids = await get_adult_chat_ids(db, influencer_id, user_id)

        if include_normal:
            if normal_chat_ids:
                deleted_message_ids = await delete_messages_by_chat_ids(db, normal_chat_ids)
                deleted_memory_ids = await delete_memories_by_chat_ids(db, normal_chat_ids)
                deleted_call_ids = await delete_calls_by_chat_ids_or_orphans(
                    db, normal_chat_ids, influencer_id, user_id
                )
                deleted_chat_ids = await delete_chats_by_ids(db, normal_chat_ids)
            else:
                deleted_call_ids = await delete_calls_orphans_only(db, influencer_id, user_id)

        if include_adult and adult_chat_ids:
            deleted_message_18_ids = await delete_messages18_by_chat_ids(db, adult_chat_ids)
            deleted_chat_18_ids = await delete_chats18_by_ids(db, adult_chat_ids)

        total_deleted = (
            len(deleted_message_ids)
            + len(deleted_message_18_ids)
            + len(deleted_memory_ids)
            + len(deleted_call_ids)
            + len(deleted_chat_ids)
            + len(deleted_chat_18_ids)
        )
        if total_deleted == 0:
            await db.rollback()
            raise AdminHistoryNotFoundError("No history found for this user/influencer pair")

        await db.commit()
    except AdminHistoryNotFoundError:
        raise
    except Exception as exc:
        await db.rollback()
        log.error(
            "admin_history_clear_failed influencer_id=%s user_id=%s mode=%s",
            influencer_id,
            user_id,
            mode,
            exc_info=True,
        )
        raise AdminHistoryClearError("Failed to clear chat history") from exc

    redis_keys_to_clear = set(normal_chat_ids)
    redis_keys_to_clear.add(f"{user_id}_{influencer_id}")
    redis_keys_to_clear.add(f"{influencer_id}_{user_id}")
    redis_keys_cleared: list[str] = []
    for key in sorted(redis_keys_to_clear):
        try:
            redis_history(key).clear()
            redis_keys_cleared.append(key)
        except Exception:
            redis_clear_failures.append(key)
            log.warning("[REDIS] Failed to clear history for chat %s", key, exc_info=True)

    elevenlabs_cache_result = await clear_elevenlabs_conversation_cache(
        list(normal_chat_ids) + list(adult_chat_ids)
    )
    log.info(
        "admin_history_clear_elevenlabs_cache mode=%s chat_ids=%s keys_attempted=%s keys_deleted=%s failures=%s",
        mode,
        elevenlabs_cache_result["chat_ids"],
        elevenlabs_cache_result["keys_attempted"],
        elevenlabs_cache_result["keys_deleted"],
        len(elevenlabs_cache_result["failed_chat_ids"]),
    )

    result = HistoryCleanupResult(
        ok=True,
        influencer_id=influencer_id,
        user_id=user_id,
        mode=mode,
        chat_ids_targeted=sorted(normal_chat_ids),
        chat_18_ids_targeted=sorted(adult_chat_ids),
        messages_deleted=len(deleted_message_ids),
        messages_18_deleted=len(deleted_message_18_ids),
        memories_deleted=len(deleted_memory_ids),
        call_records_deleted=len(deleted_call_ids),
        chats_deleted=len(deleted_chat_ids),
        chats_18_deleted=len(deleted_chat_18_ids),
        redis_keys_cleared=redis_keys_cleared,
        redis_clear_failures=redis_clear_failures,
    )

    log.info(
        "admin_history_clear_done influencer_id=%s user_id=%s mode=%s messages=%s messages_18=%s memories=%s calls=%s chats=%s chats_18=%s",
        influencer_id,
        user_id,
        result.mode,
        result.messages_deleted,
        result.messages_18_deleted,
        result.memories_deleted,
        result.call_records_deleted,
        result.chats_deleted,
        result.chats_18_deleted,
    )
    return result
