"""Repository helpers for admin history cleanup operations."""

from __future__ import annotations

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CallRecord, Chat, Chat18, Memory, Message, Message18


async def get_normal_chat_ids(db: AsyncSession, influencer_id: str, user_id: int) -> list[str]:
    rows = await db.execute(
        select(Chat.id).where(
            Chat.user_id == user_id,
            Chat.influencer_id == influencer_id,
        )
    )
    return list(rows.scalars().all())


async def get_adult_chat_ids(db: AsyncSession, influencer_id: str, user_id: int) -> list[str]:
    rows = await db.execute(
        select(Chat18.id).where(
            Chat18.user_id == user_id,
            Chat18.influencer_id == influencer_id,
        )
    )
    return list(rows.scalars().all())


async def delete_messages_by_chat_ids(db: AsyncSession, chat_ids: list[str]) -> list[int]:
    if not chat_ids:
        return []
    result = await db.execute(
        delete(Message)
        .where(Message.chat_id.in_(chat_ids))
        .returning(Message.id)
    )
    return list(result.scalars().all())


async def delete_memories_by_chat_ids(db: AsyncSession, chat_ids: list[str]) -> list[int]:
    if not chat_ids:
        return []
    result = await db.execute(
        delete(Memory)
        .where(Memory.chat_id.in_(chat_ids))
        .returning(Memory.id)
    )
    return list(result.scalars().all())


async def delete_calls_by_chat_ids_or_orphans(
    db: AsyncSession,
    chat_ids: list[str],
    influencer_id: str,
    user_id: int,
) -> list[str]:
    result = await db.execute(
        delete(CallRecord)
        .where(
            or_(
                CallRecord.chat_id.in_(chat_ids),
                and_(
                    CallRecord.user_id == user_id,
                    CallRecord.influencer_id == influencer_id,
                    CallRecord.chat_id.is_(None),
                ),
            )
        )
        .returning(CallRecord.conversation_id)
    )
    return list(result.scalars().all())


async def delete_calls_orphans_only(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
) -> list[str]:
    result = await db.execute(
        delete(CallRecord)
        .where(
            and_(
                CallRecord.user_id == user_id,
                CallRecord.influencer_id == influencer_id,
                CallRecord.chat_id.is_(None),
            )
        )
        .returning(CallRecord.conversation_id)
    )
    return list(result.scalars().all())


async def delete_chats_by_ids(db: AsyncSession, chat_ids: list[str]) -> list[str]:
    if not chat_ids:
        return []
    result = await db.execute(
        delete(Chat)
        .where(Chat.id.in_(chat_ids))
        .returning(Chat.id)
    )
    return list(result.scalars().all())


async def delete_messages18_by_chat_ids(db: AsyncSession, chat_ids: list[str]) -> list[int]:
    if not chat_ids:
        return []
    result = await db.execute(
        delete(Message18)
        .where(Message18.chat_id.in_(chat_ids))
        .returning(Message18.id)
    )
    return list(result.scalars().all())


async def delete_chats18_by_ids(db: AsyncSession, chat_ids: list[str]) -> list[str]:
    if not chat_ids:
        return []
    result = await db.execute(
        delete(Chat18)
        .where(Chat18.id.in_(chat_ids))
        .returning(Chat18.id)
    )
    return list(result.scalars().all())
