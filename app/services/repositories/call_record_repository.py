"""Call record repository.

Database access for CallRecord — INSERT, UPDATE, and aggregate queries.
No business logic; pure persistence operations.
"""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CallRecord, Chat

log = logging.getLogger(__name__)


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
        db.add(Chat(id=chat_id, user_id=0, influencer_id=influencer_id))
        await db.flush()

    db.add(CallRecord(
        conversation_id=conversation_id,
        user_id=0,
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


async def get_cumulative_trial_usage(
    db: AsyncSession,
    telegram_user_id: int,
) -> float:
    """Return the total seconds used by a Telegram user across all completed calls."""
    total = await db.scalar(
        select(func.coalesce(func.sum(CallRecord.call_duration_secs), 0.0))
        .where(
            CallRecord.telegram_user_id == telegram_user_id,
            CallRecord.status == "completed",
        )
    )
    return float(total or 0.0)
