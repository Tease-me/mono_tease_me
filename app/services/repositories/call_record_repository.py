"""Call record repository.

Database access for CallRecord — INSERT, UPDATE, and aggregate queries.
No business logic; pure persistence operations.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import CallRecord, Chat

log = logging.getLogger(__name__)

# Conservative duration estimate for abandoned calls (matches trial limit)
_ABANDONED_DURATION_SECS = 60


async def create_call_record(
    db: AsyncSession,
    *,
    influencer_id: str,
    telegram_user_id: int,
    is_adult_call: bool = True,
) -> str:
    """Insert a new CallRecord for a Telegram voice call.

    Creates the parent Chat row if it doesn't exist.
    Returns the generated conversation_id (primary key).
    """
    conversation_id = str(uuid.uuid4())
    chat_id = f"tg_{influencer_id}_{telegram_user_id}"

    existing_chat = await db.get(Chat, chat_id)
    if not existing_chat:
        db.add(Chat(id=chat_id, user_id=None, influencer_id=influencer_id))
        await db.flush()

    db.add(CallRecord(
        conversation_id=conversation_id,
        user_id=None,
        influencer_id=influencer_id,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
        is_adult_call=is_adult_call,
        status="active",
    ))
    await db.commit()

    log.info(
        "call_record.created id=%s influencer=%s tg_user=%s is_adult=%s",
        conversation_id, influencer_id, telegram_user_id, is_adult_call,
    )
    return conversation_id


async def backfill_user_id_for_telegram_user(
    db: AsyncSession,
    telegram_user_id: int,
    user_id: int,
) -> int:
    """Backfill user_id on Chat and CallRecord rows for a Telegram user.

    Called when a Telegram caller registers a web account, linking their
    pre-signup call/chat records to the new user.
    Returns total number of rows updated.
    """
    chat_id_prefix = f"tg_%_{telegram_user_id}"

    chats_result = await db.execute(
        update(Chat)
        .where(Chat.id.like(chat_id_prefix), Chat.user_id.is_(None))
        .values(user_id=user_id)
    )

    calls_result = await db.execute(
        update(CallRecord)
        .where(CallRecord.telegram_user_id == telegram_user_id, CallRecord.user_id.is_(None))
        .values(user_id=user_id)
    )

    total = (chats_result.rowcount or 0) + (calls_result.rowcount or 0)
    if total:
        log.info(
            "backfill_user_id: tg_user=%s user_id=%s chats=%d calls=%d",
            telegram_user_id, user_id,
            chats_result.rowcount, calls_result.rowcount,
        )
    return total


async def finalize_call_record(
    db: AsyncSession,
    conversation_id: str,
    duration_secs: float,
) -> None:
    """Mark a CallRecord as completed with its duration."""
    record = await db.get(CallRecord, conversation_id)
    if record:
        record.status = "completed"
        record.call_duration_secs = duration_secs
        await db.commit()
        log.info(
            "call_record.finalized id=%s duration=%.1fs",
            conversation_id, duration_secs,
        )
        if record.telegram_user_id:
            from app.services.funnel_tracking_service import track_call_completed
            asyncio.create_task(track_call_completed(
                record.telegram_user_id,
                record.influencer_id,
                conversation_id,
                duration_secs,
            ))


async def get_cumulative_trial_usage(
    db: AsyncSession,
    telegram_user_id: int,
) -> float:
    """Return the total seconds used by a Telegram user across *all* calls.

    Includes active, completed, and abandoned calls so that crashed/killed
    calls (which never transitioned to 'completed') still count toward
    the trial budget.  Null durations are treated as 0.
    """
    total = await db.scalar(
        select(
            func.coalesce(func.sum(func.coalesce(CallRecord.call_duration_secs, 0)), 0.0)
        ).where(CallRecord.telegram_user_id == telegram_user_id)
    )
    return float(total or 0.0)


async def cleanup_stale_active_calls(db: AsyncSession) -> int:
    """Mark long-running 'active' calls as 'abandoned'.

    Any CallRecord still in status='active' whose created_at is older than
    10 minutes is almost certainly a crashed/killed call that never got
    finalized.  We set a conservative duration estimate so these records
    count toward the user's trial budget.

    Returns the number of rows updated.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)

    result = await db.execute(
        update(CallRecord)
        .where(
            CallRecord.status == "active",
            CallRecord.created_at < cutoff,
        )
        .values(
            status="abandoned",
            call_duration_secs=_ABANDONED_DURATION_SECS,
        )
    )
    await db.commit()

    count = result.rowcount  # type: ignore[union-attr]
    if count:
        log.warning(
            "cleanup_stale_active_calls: marked %d stale call(s) as abandoned", count
        )
    else:
        log.info("cleanup_stale_active_calls: no stale active calls found")
    return count


async def delete_telegram_trials(
    db: AsyncSession,
) -> tuple[int, list[tuple[int, int, float]]]:
    """Delete all Telegram call records and return pre-wipe usage stats.

    Returns:
        Tuple of (deleted_count, usage_rows) where each usage row is
        (telegram_user_id, call_count, total_seconds).
    """
    rows = (await db.execute(
        select(
            CallRecord.telegram_user_id,
            func.count().label("calls"),
            func.coalesce(func.sum(CallRecord.call_duration_secs), 0).label("total_secs"),
        )
        .where(CallRecord.telegram_user_id.isnot(None))
        .group_by(CallRecord.telegram_user_id)
    )).all()

    result = await db.execute(
        delete(CallRecord).where(CallRecord.telegram_user_id.isnot(None))
    )
    await db.commit()

    deleted = result.rowcount or 0
    return deleted, list(rows)

