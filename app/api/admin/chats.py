import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.turn_handler import redis_history
from app.api.admin.common import ensure_admin
from app.data.models import CallRecord, Message, Memory, Message18, User
from app.core.session import get_db
from app.services.use_cases.admin_chat_info import (
    AdminChatInfoError,
    AdminChatInfoValidationError,
    get_admin_chat_info,
)
from app.services.use_cases.admin_history_cleanup import (
    AdminHistoryClearError,
    AdminHistoryNotFoundError,
    HistoryClearMode,
    clear_elevenlabs_conversation_cache,
    clear_pair_history,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-chats"])
log = logging.getLogger(__name__)


@router.delete(
    "/chats/history/{chat_id}",
    summary="Clear one chat history",
    description="Delete stored history, memories, and call records for a single chat ID.",
)
async def clear_chat_history_admin(
    chat_id: str,
    is_18: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        deleted_msg_ids = []
        deleted_mem_ids = []
        deleted_call_ids = []

        if is_18:
            msg_result = await db.execute(
                delete(Message18).where(Message18.chat_id == chat_id).returning(Message18.id)
            )
            deleted_msg_ids = msg_result.scalars().all()
        else:
            msg_result = await db.execute(
                delete(Message).where(Message.chat_id == chat_id).returning(Message.id)
            )
            deleted_msg_ids = msg_result.scalars().all()
            mem_result = await db.execute(
                delete(Memory).where(Memory.chat_id == chat_id).returning(Memory.id)
            )
            deleted_mem_ids = mem_result.scalars().all()
            call_result = await db.execute(
                delete(CallRecord).where(CallRecord.chat_id == chat_id).returning(CallRecord.conversation_id)
            )
            deleted_call_ids = call_result.scalars().all()

        try:
            redis_history(chat_id).clear()
        except Exception:
            log.warning("[REDIS] Failed to clear history for chat %s", chat_id)

        elevenlabs_cache_result = await clear_elevenlabs_conversation_cache([chat_id])
        log.info(
            "admin_history_single_clear_elevenlabs_cache chat_id=%s keys_attempted=%s keys_deleted=%s failures=%s",
            chat_id,
            elevenlabs_cache_result["keys_attempted"],
            elevenlabs_cache_result["keys_deleted"],
            len(elevenlabs_cache_result["failed_chat_ids"]),
        )

        if not deleted_msg_ids and not deleted_call_ids and not deleted_mem_ids:
            await db.rollback()
            raise HTTPException(status_code=404, detail="Chat not found or empty")

        await db.commit()
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear chat history")

    return {
        "ok": True,
        "chat_id": chat_id,
        "is_18": is_18,
        "messages_deleted": len(deleted_msg_ids),
        "memories_deleted": len(deleted_mem_ids),
        "call_records_deleted": len(deleted_call_ids),
    }


@router.delete(
    "/chats/history/{influencer_id}/{user_id}",
    summary="Clear history by user and influencer",
    description="Delete chat history for a user and influencer pair using the selected clear mode.",
)
async def clear_chat_history_by_user_influencer(
    influencer_id: str,
    user_id: int,
    mode: HistoryClearMode = "both",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        result = await clear_pair_history(
            db,
            influencer_id=influencer_id,
            user_id=user_id,
            mode=mode,
        )
    except AdminHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except AdminHistoryClearError:
        raise HTTPException(status_code=500, detail="Failed to clear chat history")

    return result.as_dict()


@router.get(
    "/chats/info/{influencer_id}/{user_id}",
    summary="Get chat info by user and influencer",
    description="Return admin chat statistics and timing information for a user and influencer pair.",
)
async def get_chat_info_by_user_influencer(
    influencer_id: str,
    user_id: int,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        result = await get_admin_chat_info(
            db,
            influencer_id=influencer_id,
            user_id=user_id,
            from_dt=from_,
            to_dt=to,
        )
    except AdminChatInfoValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminChatInfoError:
        raise HTTPException(status_code=500, detail="Failed to fetch chat info")

    return result.as_dict()
