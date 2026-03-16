import io
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.turn_handler import redis_history
from app.db.models import (
    AdultCharacter,
    ApiUsageLog,
    CallRecord,
    ContentViolation,
    InfluencerCharacterMeta,
    Message,
    Memory,
    Message18,
)
from app.db.session import get_db
from app.utils.auth.dependencies import get_current_user

from sqlalchemy import select, func, desc, Integer
from app.db.models import RelationshipState, Influencer, User
from app.domain.errors.knowledge_errors import (
    KnowledgeNotFoundError,
    KnowledgePersistenceError,
    KnowledgeSyncError,
    KnowledgeValidationError,
)
from app.schemas.knowledge import KnowledgeUpsertInput
from app.use_cases.knowledge_sync import (
    delete_knowledge_remote_first,
    get_knowledge_for_admin,
    upsert_knowledge_remote_first,
)
from app.use_cases.admin_history_cleanup import (
    AdminHistoryClearError,
    AdminHistoryNotFoundError,
    HistoryClearMode,
    clear_elevenlabs_conversation_cache,
    clear_pair_history,
)
from app.use_cases.admin_chat_info import (
    AdminChatInfoError,
    AdminChatInfoValidationError,
    get_admin_chat_info,
)
from app.use_cases.admin_logs import (
    AdminLogsAccessError,
    AdminLogsValidationError,
    get_log_download,
    get_log_files,
    get_logs_page,
    stream_logs_sse,
)
from app.utils.storage.s3 import delete_file_from_s3, generate_presigned_url, save_sample_audio_to_s3
from app.repositories.influencer_character_assets_repository import (
    get_influencer_character_asset_keys,
    get_influencer_character_asset_presence,
    get_influencer_character_asset_state,
    delete_influencer_character_asset,
    upload_influencer_character_photo,
    upload_influencer_character_video,
)
from app.use_cases.admin_user_analytics import (
    get_analytics_overview,
    get_user_growth,
    get_user_engagement,
    get_user_spending,
    get_user_retention,
    get_user_detail,
)

from pydantic import BaseModel, Field
from typing import Literal, Optional
from app.schemas.influencer import (
    AdminInfluencerAdultCharacterAssetOut,
    AdminInfluencerCharacterAssetMutationOut,
)

from app.constants.relationship_stages import STAGE_POINTS_MIN, STAGE_POINTS_MAX

router = APIRouter(prefix="/admin", tags=["admin"])
log = logging.getLogger(__name__)


async def _get_influencer_character_overlay(
    db: AsyncSession,
    influencer_id: str,
    character_id: int,
) -> InfluencerCharacterMeta | None:
    result = await db.execute(
        select(InfluencerCharacterMeta).where(
            InfluencerCharacterMeta.influencer_id == influencer_id,
            InfluencerCharacterMeta.character_id == character_id,
        )
    )
    return result.scalars().first()


async def _build_admin_influencer_adult_characters(
    db: AsyncSession,
    influencer_id: str,
) -> list[AdminInfluencerAdultCharacterAssetOut]:
    characters_result = await db.execute(
        select(AdultCharacter)
        .where(AdultCharacter.is_active.is_(True))
        .order_by(AdultCharacter.display_order, AdultCharacter.id)
    )
    characters = sorted(
        characters_result.scalars().all(),
        key=lambda character: (character.display_order, character.id),
    )

    overlay_result = await db.execute(
        select(InfluencerCharacterMeta).where(
            InfluencerCharacterMeta.influencer_id == influencer_id,
        )
    )
    overlays = {
        overlay.character_id: overlay
        for overlay in overlay_result.scalars().all()
        if overlay.is_active
    }

    items: list[AdminInfluencerAdultCharacterAssetOut] = []
    for character in characters:
        overlay = overlays.get(character.id)
        asset_state = get_influencer_character_asset_state(influencer_id, character.id)
        items.append(
            AdminInfluencerAdultCharacterAssetOut(
                id=character.id,
                slug=character.slug,
                name=character.name,
                description=character.description,
                is_active=character.is_active,
                display_order=character.display_order,
                base_lottie_text=character.lottie_text,
                photo_url=asset_state["photo_url"],
                photo_2x_url=asset_state["photo_2x_url"],
                video_mp4_url=asset_state["video_mp4_url"],
                video_webm_url=asset_state["video_webm_url"],
                video_preview_png_url=asset_state["video_preview_png_url"],
                has_photo=asset_state["has_photo"],
                has_complete_video_set=asset_state["has_complete_video_set"],
                resolved_lottie_text=character.lottie_text,
                meta_json=overlay.meta_json if overlay else None,
                has_influencer_override=overlay is not None,
            )
        )
    return items

@router.delete("/chats/history/{chat_id}")
async def clear_chat_history_admin(
    chat_id: str,
    is_18: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
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

@router.delete("/chats/history/{influencer_id}/{user_id}")
async def clear_chat_history_by_user_influencer(
    influencer_id: str,
    user_id: int,
    mode: HistoryClearMode = "both",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

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


@router.get("/chats/info/{influencer_id}/{user_id}")
async def get_chat_info_by_user_influencer(
    influencer_id: str,
    user_id: int,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

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


@router.get("/logs")
async def get_admin_logs(
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    limit: int = 200,
    cursor: str | None = None,
    direction: Literal["backward", "forward"] = "backward",
    current_user: User = Depends(get_current_user),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = get_logs_page(
            q=q,
            level=level,
            file=file,
            limit=limit,
            cursor=cursor,
            direction=direction,
        )
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch logs")

    return result.as_dict()


@router.get("/logs/files")
async def get_admin_logs_files(
    current_user: User = Depends(get_current_user),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = get_log_files()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch log files")

    return result.as_dict()


@router.get("/logs/download")
async def download_admin_log_file(
    file: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = get_log_download(file)
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to download log file")

    return FileResponse(
        path=str(result.file_path),
        filename=result.file_name,
        media_type="text/plain; charset=utf-8",
    )


@router.get("/logs/stream")
async def stream_admin_logs(
    request: Request,
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    poll_interval_ms: int = 1500,
    current_user: User = Depends(get_current_user),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        source = stream_logs_sse(
            q=q,
            level=level,
            file=file,
            poll_interval_ms=poll_interval_ms,
        )
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to stream logs")

    async def event_stream():
        try:
            async for chunk in source:
                if await request.is_disconnected():
                    break
                yield chunk
        finally:
            await source.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def sentiment_label(score: float) -> str:
    """
    Legacy function - now provides a progress label within the current stage.
    Since sentiment_score is now 0-100% progress within current stage,
    this returns a progress descriptor rather than an emotional state.
    The actual relationship level is captured by 'state' (STRANGERS, FRIENDS, etc.)
    """
    if score < 25:
        return "EARLY"
    elif score < 50:
        return "DEVELOPING"
    elif score < 75:
        return "PROGRESSING"
    else:
        return "ADVANCED"
    
@router.get("/relationships")
async def list_relationships(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    q = select(RelationshipState).where(RelationshipState.user_id == user_id)
    res = await db.execute(q)
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "influencer_id": r.influencer_id,
            "trust": r.trust,
            "closeness": r.closeness,
            "attraction": r.attraction,
            "safety": r.safety,
            "state": r.state,
            "stage_points": r.stage_points,
            "sentiment": sentiment_label(r.sentiment_score),
            "exclusive_agreed": r.exclusive_agreed,
            "girlfriend_confirmed": r.girlfriend_confirmed,
            "sentiment_score": r.sentiment_score,
            "sentiment_delta": r.sentiment_delta,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]

@router.get("/users")
async def list_users(
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User)
    if current_user.id != 1:
        

        raise HTTPException(status_code=403, detail="Admin only")

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (User.email.ilike(like)) |
            (User.username.ilike(like)) |
            (User.full_name.ilike(like))
        )

    res = await db.execute(stmt)
    users = res.scalars().all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
        }
        for u in users
    ]

class RelationshipPatch(BaseModel):
    user_id: int
    influencer_id: str

    trust: Optional[float] = Field(default=None, ge=0, le=100)
    closeness: Optional[float] = Field(default=None, ge=0, le=100)
    attraction: Optional[float] = Field(default=None, ge=0, le=100)
    safety: Optional[float] = Field(default=None, ge=0, le=100)

    state: Optional[str] = None

    stage_points: Optional[float] = Field(default=None, ge=STAGE_POINTS_MIN, le=STAGE_POINTS_MAX)
    sentiment_score: Optional[float] = Field(default=None, ge=0, le=100)  # 0-100% progress within stage
    sentiment_delta: Optional[float] = Field(default=None, ge=-15, le=15)  # Progress change per turn

    exclusive_agreed: Optional[bool] = None
    girlfriend_confirmed: Optional[bool] = None

    dtr_stage: Optional[int] = Field(default=None, ge=0)
    dtr_cooldown_until: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None


class InfluencerKnowledgePayload(BaseModel):
    text: str = Field(min_length=1)


@router.patch("/relationships")
async def patch_relationship(
    payload: RelationshipPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):    
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    q = select(RelationshipState).where(
        RelationshipState.user_id == payload.user_id,
        RelationshipState.influencer_id == payload.influencer_id,
    )
    res = await db.execute(q)
    rel = res.scalar_one_or_none()

    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if payload.trust is not None:
        rel.trust = payload.trust
    if payload.closeness is not None:
        rel.closeness = payload.closeness
    if payload.attraction is not None:
        rel.attraction = payload.attraction
    if payload.safety is not None:
        rel.safety = payload.safety

    if payload.state is not None:
        rel.state = payload.state

    if payload.stage_points is not None:
        rel.stage_points = payload.stage_points

    if payload.sentiment_score is not None:
        rel.sentiment_score = payload.sentiment_score
    
    if payload.sentiment_delta is not None:
        rel.sentiment_delta = payload.sentiment_delta

    if payload.exclusive_agreed is not None:
        rel.exclusive_agreed = payload.exclusive_agreed
    if payload.girlfriend_confirmed is not None:
        rel.girlfriend_confirmed = payload.girlfriend_confirmed

    if payload.dtr_stage is not None:
        rel.dtr_stage = payload.dtr_stage
    if payload.dtr_cooldown_until is not None:
        rel.dtr_cooldown_until = payload.dtr_cooldown_until

    if payload.last_interaction_at is not None:
        rel.last_interaction_at = payload.last_interaction_at

    if rel.girlfriend_confirmed:
        rel.state = "GIRLFRIEND"
        rel.exclusive_agreed = True

    rel.updated_at = datetime.now(timezone.utc)

    db.add(rel)
    await db.commit()
    await db.refresh(rel)

    return {
        "ok": True,
        "relationship": {
            "id": rel.id,
            "user_id": rel.user_id,
            "influencer_id": rel.influencer_id,
            "trust": rel.trust,
            "closeness": rel.closeness,
            "attraction": rel.attraction,
            "safety": rel.safety,
            "state": rel.state,
            "stage_points": rel.stage_points,
            "sentiment_score": rel.sentiment_score,
            "sentiment_delta": rel.sentiment_delta,
            "exclusive_agreed": rel.exclusive_agreed,
            "girlfriend_confirmed": rel.girlfriend_confirmed,
            "updated_at": rel.updated_at.isoformat() if rel.updated_at else None,
        }
    }

@router.post("/relationships/update")
async def update_relationship(
    payload: RelationshipPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):  
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    q = select(RelationshipState).where(
        RelationshipState.user_id == payload.user_id,
        RelationshipState.influencer_id == payload.influencer_id,
    )
    res = await db.execute(q)
    rel = res.scalar_one_or_none()

    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if payload.trust is not None:
        rel.trust = payload.trust
    if payload.closeness is not None:
        rel.closeness = payload.closeness
    if payload.attraction is not None:
        rel.attraction = payload.attraction
    if payload.safety is not None:
        rel.safety = payload.safety

    if payload.state is not None:
        rel.state = payload.state
    if payload.stage_points is not None:
        rel.stage_points = payload.stage_points
    if payload.sentiment_score is not None:
        rel.sentiment_score = payload.sentiment_score
    if payload.sentiment_delta is not None:
        rel.sentiment_delta = payload.sentiment_delta

    if payload.exclusive_agreed is not None:
        rel.exclusive_agreed = payload.exclusive_agreed
    if payload.girlfriend_confirmed is not None:
        rel.girlfriend_confirmed = payload.girlfriend_confirmed

    if rel.girlfriend_confirmed:
        rel.state = "GIRLFRIEND"
        rel.exclusive_agreed = True

    rel.updated_at = datetime.now(timezone.utc)

    db.add(rel)
    await db.commit()
    await db.refresh(rel)

    return {"ok": True}


@router.get(
    "/influencer/{influencer_id}/adult-characters",
    response_model=list[AdminInfluencerAdultCharacterAssetOut],
)
async def get_admin_influencer_adult_characters(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    return await _build_admin_influencer_adult_characters(db, influencer_id)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/assets",
    response_model=AdminInfluencerCharacterAssetMutationOut,
)
async def upsert_admin_influencer_character_assets(
    influencer_id: str,
    character_id: int,
    photo: UploadFile | None = File(default=None),
    photo_2x: UploadFile | None = File(default=None),
    video_mp4: UploadFile | None = File(default=None),
    video_webm: UploadFile | None = File(default=None),
    video_preview_png: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")

    if not any((photo, photo_2x, video_mp4, video_webm, video_preview_png)):
        raise HTTPException(status_code=400, detail="At least one asset file is required")

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    uploaded_keys: list[str] = []

    try:
        if photo:
            photo_bytes = await photo.read()
            if not photo_bytes:
                raise HTTPException(status_code=400, detail="Empty photo file")
            uploaded_keys.append(
                await upload_influencer_character_photo(
                io.BytesIO(photo_bytes),
                photo.filename,
                photo.content_type or "image/jpeg",
                influencer_id,
                character_id,
                variant="photo",
                )
            )

        if photo_2x:
            photo_2x_bytes = await photo_2x.read()
            if not photo_2x_bytes:
                raise HTTPException(status_code=400, detail="Empty photo_2x file")
            uploaded_keys.append(
                await upload_influencer_character_photo(
                    io.BytesIO(photo_2x_bytes),
                    photo_2x.filename,
                    photo_2x.content_type or "image/jpeg",
                    influencer_id,
                    character_id,
                    variant="photo_2x",
                )
            )

        if video_mp4:
            video_mp4_bytes = await video_mp4.read()
            if not video_mp4_bytes:
                raise HTTPException(status_code=400, detail="Empty video_mp4 file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(video_mp4_bytes),
                    video_mp4.content_type or "video/mp4",
                    influencer_id,
                    character_id,
                    variant="video_mp4",
                )
            )

        if video_webm:
            video_webm_bytes = await video_webm.read()
            if not video_webm_bytes:
                raise HTTPException(status_code=400, detail="Empty video_webm file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(video_webm_bytes),
                    video_webm.content_type or "video/webm",
                    influencer_id,
                    character_id,
                    variant="video_webm",
                )
            )

        if video_preview_png:
            preview_bytes = await video_preview_png.read()
            if not preview_bytes:
                raise HTTPException(status_code=400, detail="Empty video_preview_png file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(preview_bytes),
                    video_preview_png.content_type or "image/png",
                    influencer_id,
                    character_id,
                    variant="video_preview_png",
                )
            )
    except HTTPException:
        for key in uploaded_keys:
            try:
                await delete_influencer_character_asset(key)
            except Exception:
                log.warning("Failed to cleanup uploaded character asset %s", key, exc_info=True)
        raise
    except Exception:
        for key in uploaded_keys:
            try:
                await delete_influencer_character_asset(key)
            except Exception:
                log.warning("Failed to cleanup uploaded character asset %s", key, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save character assets")

    asset_state = get_influencer_character_asset_state(influencer_id, character_id)

    return AdminInfluencerCharacterAssetMutationOut(
        influencer_id=influencer_id,
        character_id=character_id,
        photo_url=asset_state["photo_url"],
        photo_2x_url=asset_state["photo_2x_url"],
        video_mp4_url=asset_state["video_mp4_url"],
        video_webm_url=asset_state["video_webm_url"],
        video_preview_png_url=asset_state["video_preview_png_url"],
        has_photo=asset_state["has_photo"],
        has_complete_video_set=asset_state["has_complete_video_set"],
        meta_json=overlay.meta_json if overlay else None,
        has_influencer_override=overlay is not None,
    )


@router.delete(
    "/influencer/{influencer_id}/adult-characters/{character_id}/assets/{asset_type}",
    response_model=AdminInfluencerCharacterAssetMutationOut,
)
async def delete_admin_influencer_character_asset(
    influencer_id: str,
    character_id: int,
    asset_type: Literal["photo", "photo_2x", "video_mp4", "video_webm", "video_preview_png", "video"],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    keys = get_influencer_character_asset_keys(influencer_id, character_id)
    presence = get_influencer_character_asset_presence(influencer_id, character_id)
    target_keys = {
        "photo": [keys["photo"]],
        "photo_2x": [keys["photo_2x"]],
        "video_mp4": [keys["video_mp4"]],
        "video_webm": [keys["video_webm"]],
        "video_preview_png": [keys["video_preview_png"]],
        "video": [keys["video_mp4"], keys["video_webm"], keys["video_preview_png"]],
    }[asset_type]
    key_to_presence = {
        keys["photo"]: presence["photo"],
        keys["photo_2x"]: presence["photo_2x"],
        keys["video_mp4"]: presence["video_mp4"],
        keys["video_webm"]: presence["video_webm"],
        keys["video_preview_png"]: presence["video_preview_png"],
    }
    existing_keys = [key for key in target_keys if key_to_presence[key]]
    if not existing_keys:
        raise HTTPException(status_code=404, detail=f"{asset_type} asset not found")

    for key in existing_keys:
        try:
            await delete_influencer_character_asset(key)
        except Exception:
            log.warning("Failed to delete character asset file %s", key, exc_info=True)

    asset_state = get_influencer_character_asset_state(influencer_id, character_id)
    return AdminInfluencerCharacterAssetMutationOut(
        influencer_id=influencer_id,
        character_id=character_id,
        photo_url=asset_state["photo_url"],
        photo_2x_url=asset_state["photo_2x_url"],
        video_mp4_url=asset_state["video_mp4_url"],
        video_webm_url=asset_state["video_webm_url"],
        video_preview_png_url=asset_state["video_preview_png_url"],
        has_photo=asset_state["has_photo"],
        has_complete_video_set=asset_state["has_complete_video_set"],
        meta_json=overlay.meta_json if overlay else None,
        has_influencer_override=overlay is not None,
    )


@router.post("/influencer/{influencer_id}/samples")
async def upload_influencer_sample(
    influencer_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    s3_key = await save_sample_audio_to_s3(
        io.BytesIO(file_bytes),
        file.filename or "sample.mp3",
        file.content_type or "audio/mpeg",
        influencer_id,
    )

    sample_entry = {
        "s3_key": s3_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if influencer.samples is None:
        influencer.samples = [sample_entry]
    else:
        influencer.samples = influencer.samples + [sample_entry]

    await db.commit()
    await db.refresh(influencer)

    return {
        "id": s3_key,
        "s3_key": s3_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "url": generate_presigned_url(s3_key),
        "created_at": sample_entry["created_at"],
    }


@router.delete("/influencer/{influencer_id}/samples/{sample_id}")
async def delete_influencer_sample(
    influencer_id: str,
    sample_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    if not influencer.samples:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample = next((s for s in influencer.samples if s.get("s3_key") == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    influencer.samples = [s for s in influencer.samples if s.get("s3_key") != sample_id]

    try:
        await delete_file_from_s3(sample_id)
    except Exception:
        log.warning("Failed to delete S3 sample file %s", sample_id, exc_info=True)

    await db.commit()

    return {"ok": True, "deleted_id": sample_id}

@router.get("/moderation")
async def get_moderation_dashboard(
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    current_user: User = Depends(get_current_user),

    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    users_stmt = select(User).where(User.moderation_status != "CLEAN")
    users_stmt = users_stmt.order_by(desc(User.last_violation_at))
    users_result = await db.execute(users_stmt)
    flagged_users = users_result.scalars().all()
    
    violations_stmt = select(ContentViolation)
    if category:
        violations_stmt = violations_stmt.where(ContentViolation.category == category)
    if user_id:
        violations_stmt = violations_stmt.where(ContentViolation.user_id == user_id)
    
    count_stmt = select(func.count()).select_from(violations_stmt.subquery())
    total_violations = (await db.execute(count_stmt)).scalar() or 0
    
    violations_stmt = violations_stmt.order_by(desc(ContentViolation.created_at))
    violations_stmt = violations_stmt.offset((page - 1) * page_size).limit(page_size)
    violations_result = await db.execute(violations_stmt)
    violations = violations_result.scalars().all()
    
    return {
        "flagged_users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "moderation_status": u.moderation_status,
                "violation_count": u.violation_count,
                "first_violation_at": u.first_violation_at.isoformat() if u.first_violation_at else None,
                "last_violation_at": u.last_violation_at.isoformat() if u.last_violation_at else None,
            }
            for u in flagged_users
        ],
        "violations": {
            "total": total_violations,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": v.id,
                    "user_id": v.user_id,
                    "chat_id": v.chat_id,
                    "influencer_id": v.influencer_id,
                    "message_content": v.message_content,
                    "category": v.category,
                    "severity": v.severity,
                    "keyword_matched": v.keyword_matched,
                    "ai_confidence": v.ai_confidence,
                    "detection_tier": v.detection_tier,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in violations
            ]
        }
    }


@router.put("/influencers/{influencer_id}/knowledge")
async def upsert_knowledge(
    influencer_id: str,
    payload: InfluencerKnowledgePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    try:
        result = await upsert_knowledge_remote_first(
            db=db,
            influencer=influencer,
            payload=KnowledgeUpsertInput(
                influencer_id=influencer_id,
                text=payload.text,
            ),
        )
    except KnowledgeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KnowledgeSyncError as exc:
        log.error("knowledge_sync_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to sync knowledge with ElevenLabs")
    except KnowledgePersistenceError as exc:
        log.error("knowledge_persist_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to persist influencer knowledge")
    except Exception as exc:
        log.error("knowledge_upsert_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upsert influencer knowledge")

    return {
        "ok": True,
        "influencer_id": influencer_id,
        "document_id": result.document_id,
        "chunk_count": result.chunk_count,
        "updated_at": result.updated_at,
    }


@router.get("/influencers/{influencer_id}/knowledge")
async def get_knowledge(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    try:
        document_id, text_value, text_hash, chunk_count, updated_at, _remote_document_id = await get_knowledge_for_admin(
            db=db,
            influencer_id=influencer_id,
        )
    except KnowledgeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.error("knowledge_get_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch influencer knowledge")

    return {
        "ok": True,
        "influencer_id": influencer_id,
        "document_id": document_id,
        "text": text_value,
        "text_hash": text_hash,
        "chunk_count": chunk_count,
        "updated_at": updated_at,
    }


@router.delete("/influencers/{influencer_id}/knowledge")
async def delete_knowledge(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    try:
        result = await delete_knowledge_remote_first(
            db=db,
            influencer=influencer,
        )
    except KnowledgeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KnowledgeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except KnowledgeSyncError as exc:
        log.error("knowledge_delete_sync_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to sync delete with ElevenLabs")
    except KnowledgePersistenceError as exc:
        log.error("knowledge_delete_persist_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete influencer knowledge")
    except Exception as exc:
        log.error("knowledge_delete_failed influencer_id=%s err=%s", influencer_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete influencer knowledge")

    return {"ok": True, "influencer_id": influencer_id, "deleted": result.deleted}


def _parse_period(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "1h":
        return now - timedelta(hours=1)
    if period == "7d":
        return now - timedelta(days=7)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    # default 24h
    return now - timedelta(hours=24)

@router.get("/api-usage/summary")
async def get_api_usage_summary(
    period: str = "24h",
    group_by: str = "category",  # category, provider, model
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
        
    start_time = _parse_period(period)
    
    group_col = getattr(ApiUsageLog, group_by, ApiUsageLog.category)
    
    stmt = (
        select(
            group_col.label("group_name"),
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("total_cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
            func.sum(ApiUsageLog.input_tokens).label("total_input_tokens"),
            func.sum(ApiUsageLog.output_tokens).label("total_output_tokens"),
            func.avg(ApiUsageLog.latency_ms).label("avg_latency_ms"),
            func.max(ApiUsageLog.latency_ms).label("max_latency_ms"),
            func.sum(ApiUsageLog.duration_secs).label("total_duration_secs"),
            func.sum(func.cast(ApiUsageLog.success.is_(False), Integer)).label("errors")
        )
        .where(ApiUsageLog.created_at >= start_time)
        .group_by(group_col)
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    groups = [
         {
             "key": getattr(r, "group_name") or "unknown",
             "total_calls": r.requests,
             "total_tokens": int(r.total_tokens) if r.total_tokens else 0,
             "total_input_tokens": int(r.total_input_tokens) if r.total_input_tokens else 0,
             "total_output_tokens": int(r.total_output_tokens) if r.total_output_tokens else 0,
             "estimated_cost_usd": (float(r.total_cost_micros) / 1000000.0) if r.total_cost_micros else 0.0,
             "avg_latency_ms": float(r.avg_latency_ms) if r.avg_latency_ms else None,
             "max_latency_ms": int(r.max_latency_ms) if r.max_latency_ms else None,
             "total_duration_secs": float(r.total_duration_secs) if r.total_duration_secs else None,
             "error_count": int(r.errors) if r.errors else 0,
             "error_rate": (r.errors / r.requests) if r.requests > 0 else 0.0,
         }
         for r in rows
    ]
    return {
        "period": period,
        "group_by": group_by,
        "groups": groups,
    }

@router.get("/api-usage/top-users")
async def get_api_usage_top_users(
    period: str = "24h",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
        
    start_time = _parse_period(period)
    
    stmt = (
        select(
            ApiUsageLog.user_id,
            User.email,
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("tokens")
        )
        .join(User, User.id == ApiUsageLog.user_id, isouter=True)
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.user_id.isnot(None))
        .group_by(ApiUsageLog.user_id, User.email)
        .order_by(desc("cost_micros"))
        .limit(10)
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    users = [
         {
             "user_id": r.user_id,
             "email": r.email,
             "total_calls": r.requests,
             "total_tokens": int(r.tokens) if r.tokens else 0,
             "estimated_cost_usd": (float(r.cost_micros) / 1000000.0) if r.cost_micros else 0.0,
         }
         for r in rows
    ]
    return {"users": users}

@router.get("/api-usage/top-influencers")
async def get_api_usage_top_influencers(
    period: str = "24h",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
        
    start_time = _parse_period(period)
    
    stmt = (
        select(
            ApiUsageLog.influencer_id,
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("tokens"),
            func.sum(ApiUsageLog.duration_secs).label("duration_secs")
        )
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.influencer_id.isnot(None))
        .group_by(ApiUsageLog.influencer_id)
        .order_by(desc("cost_micros"))
        .limit(10)
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    influencers = [
         {
             "influencer_id": r.influencer_id,
             "total_calls": r.requests,
             "total_tokens": int(r.tokens) if r.tokens else 0,
             "estimated_cost_usd": (float(r.cost_micros) / 1000000.0) if r.cost_micros else 0.0,
             "total_call_secs": float(r.duration_secs) if r.duration_secs else 0.0,
         }
         for r in rows
    ]
    return {"influencers": influencers}

@router.get("/api-usage/errors")
async def get_api_usage_errors(
    period: str = "24h",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
        
    start_time = _parse_period(period)
    
    stmt = (
        select(ApiUsageLog)
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.success.is_(False))
        .order_by(desc(ApiUsageLog.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()
    
    errors = [
        {
            "id": r.id,
            "timestamp": r.created_at.isoformat(),
            "created_at": r.created_at.isoformat(),
            "category": r.category,
            "provider": r.provider,
            "model": r.model,
            "purpose": r.purpose,
            "error_message": r.error_message,
            "user_id": r.user_id,
            "influencer_id": r.influencer_id,
        }
        for r in rows
    ]
    return {"errors": errors, "total_errors": len(errors)}


# ── User Analytics ──────────────────────────────────────────────

@router.get("/analytics/overview")
async def analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """High-level KPI dashboard summary."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        return await get_analytics_overview(db)
    except Exception:
        log.error("analytics_overview_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch analytics overview")


@router.get("/analytics/user-growth")
async def analytics_user_growth(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Registration trends over time."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        return await get_user_growth(db, period)
    except Exception:
        log.error("analytics_user_growth_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user growth data")


@router.get("/analytics/user-engagement")
async def analytics_user_engagement(
    period: str = "24h",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activity metrics: messages, calls, active users, channels."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        return await get_user_engagement(db, period)
    except Exception:
        log.error("analytics_user_engagement_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user engagement data")


@router.get("/analytics/user-spending")
async def analytics_user_spending(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revenue analysis: total revenue, ARPU, top spenders, subscriptions."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        return await get_user_spending(db, period)
    except Exception:
        log.error("analytics_user_spending_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user spending data")


@router.get("/analytics/user-retention")
async def analytics_user_retention(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """DAU / WAU / MAU counts and daily active user trend."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        return await get_user_retention(db, period)
    except Exception:
        log.error("analytics_user_retention_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user retention data")


@router.get("/analytics/user-detail/{user_id}")
async def analytics_user_detail(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deep-dive analytics for a single user."""
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        result = await get_user_detail(db, user_id)
        if result is None:
            raise HTTPException(status_code=404, detail="User not found")
        return result
    except HTTPException:
        raise
    except Exception:
        log.error("analytics_user_detail_failed user_id=%s", user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user detail")
