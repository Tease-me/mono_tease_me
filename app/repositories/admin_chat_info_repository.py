"""Repository helpers for admin chat info metrics."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CallRecord, Chat, Chat18, Memory, Message, Message18


def _apply_time_bounds(stmt, column, from_dt: datetime | None, to_dt: datetime | None):
    if from_dt is not None:
        stmt = stmt.where(column >= from_dt)
    if to_dt is not None:
        stmt = stmt.where(column <= to_dt)
    return stmt


async def count_normal_chats(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = select(func.count(Chat.id)).where(
        Chat.user_id == user_id,
        Chat.influencer_id == influencer_id,
    )
    stmt = _apply_time_bounds(stmt, Chat.started_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_normal_messages(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = (
        select(func.count(Message.id))
        .select_from(Message)
        .join(Chat, Chat.id == Message.chat_id)
        .where(
            Chat.user_id == user_id,
            Chat.influencer_id == influencer_id,
        )
    )
    stmt = _apply_time_bounds(stmt, Message.created_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_normal_memories(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = (
        select(func.count(Memory.id))
        .select_from(Memory)
        .join(Chat, Chat.id == Memory.chat_id)
        .where(
            Chat.user_id == user_id,
            Chat.influencer_id == influencer_id,
        )
    )
    stmt = _apply_time_bounds(stmt, Memory.created_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_calls(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = select(func.count(CallRecord.conversation_id)).where(
        CallRecord.user_id == user_id,
        CallRecord.influencer_id == influencer_id,
    )
    stmt = _apply_time_bounds(stmt, CallRecord.created_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_adult_chats(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = select(func.count(Chat18.id)).where(
        Chat18.user_id == user_id,
        Chat18.influencer_id == influencer_id,
    )
    stmt = _apply_time_bounds(stmt, Chat18.started_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_adult_messages(
    db: AsyncSession,
    influencer_id: str,
    user_id: int,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> int:
    stmt = (
        select(func.count(Message18.id))
        .select_from(Message18)
        .join(Chat18, Chat18.id == Message18.chat_id)
        .where(
            Chat18.user_id == user_id,
            Chat18.influencer_id == influencer_id,
        )
    )
    stmt = _apply_time_bounds(stmt, Message18.created_at, from_dt, to_dt)
    res = await db.execute(stmt)
    return int(res.scalar() or 0)
