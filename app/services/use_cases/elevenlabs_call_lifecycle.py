from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.repositories.call_record import upsert_pending_call_record
from app.services.chat_service import get_or_create_chat

log = logging.getLogger(__name__)


async def save_pending_conversation(
    db: AsyncSession,
    conversation_id: str,
    user_id: int,
    influencer_id: str | None,
    sid: str | None,
    is_adult_call: bool = False,
    adult_character_id: int | None = None,
) -> str | None:
    chat_id: str | None = None
    if user_id and influencer_id:
        try:
            chat_id = await get_or_create_chat(db, user_id, influencer_id)
        except Exception as exc:
            log.warning(
                "save_pending_conversation.get_or_create_chat_failed user=%s infl=%s err=%s",
                user_id,
                influencer_id,
                exc,
            )
            chat_id = f"{user_id}_{influencer_id}"

    await upsert_pending_call_record(
        db,
        conversation_id=conversation_id,
        user_id=user_id,
        influencer_id=influencer_id,
        chat_id=chat_id,
        sid=sid,
        is_adult_call=is_adult_call,
        adult_character_id=adult_character_id,
    )
    return chat_id
