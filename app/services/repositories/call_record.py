from __future__ import annotations

from sqlalchemy import update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import CallRecord


async def upsert_pending_call_record(
    db: AsyncSession,
    *,
    conversation_id: str,
    user_id: int,
    influencer_id: str | None,
    chat_id: str | None,
    sid: str | None,
    is_adult_call: bool = False,
    adult_character_id: int | None = None,
) -> None:
    stmt = (
        pg_insert(CallRecord)
        .values(
            conversation_id=conversation_id,
            user_id=user_id,
            influencer_id=influencer_id,
            chat_id=chat_id,
            sid=sid,
            is_adult_call=is_adult_call,
            adult_character_id=adult_character_id,
            status="pending",
        )
        .on_conflict_do_update(
            index_elements=[CallRecord.conversation_id],
            set_={
                "user_id": user_id,
                "influencer_id": influencer_id,
                "chat_id": chat_id,
                "sid": sid,
                "is_adult_call": is_adult_call,
                "adult_character_id": adult_character_id,
                "status": "pending",
            },
        )
    )
    await db.execute(stmt)
    await db.commit()


async def claim_billing_slot(db: AsyncSession, conversation_id: str) -> bool:
    result = await db.execute(
        sa_update(CallRecord)
        .where(
            CallRecord.conversation_id == conversation_id,
            CallRecord.status.notin_(["billing", "billed"]),
        )
        .values(status="billing")
    )
    await db.flush()
    return (result.rowcount or 0) > 0


async def mark_billing_done(db: AsyncSession, conversation_id: str) -> None:
    await db.execute(
        sa_update(CallRecord)
        .where(CallRecord.conversation_id == conversation_id)
        .values(status="billed")
    )


async def reset_billing_slot(db: AsyncSession, conversation_id: str) -> None:
    await db.execute(
        sa_update(CallRecord)
        .where(
            CallRecord.conversation_id == conversation_id,
            CallRecord.status == "billing",
        )
        .values(status="done")
    )
    await db.commit()
