import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.db.models import Influencer, User
from app.db.session import get_db
from app.errors.knowledge_errors import (
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
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-knowledge"])
log = logging.getLogger(__name__)


class InfluencerKnowledgePayload(BaseModel):
    text: str = Field(min_length=1)


@router.put(
    "/influencers/{influencer_id}/knowledge",
    summary="Upsert influencer knowledge",
    description="Create or replace the knowledge document stored for an influencer.",
)
async def upsert_knowledge(
    influencer_id: str,
    payload: InfluencerKnowledgePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    try:
        result = await upsert_knowledge_remote_first(
            db=db,
            influencer=influencer,
            payload=KnowledgeUpsertInput(influencer_id=influencer_id, text=payload.text),
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


@router.get(
    "/influencers/{influencer_id}/knowledge",
    summary="Get influencer knowledge",
    description="Return the current stored knowledge document and metadata for an influencer.",
)
async def get_knowledge(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
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


@router.delete(
    "/influencers/{influencer_id}/knowledge",
    summary="Delete influencer knowledge",
    description="Delete the stored knowledge document for an influencer.",
)
async def delete_knowledge(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    try:
        result = await delete_knowledge_remote_first(db=db, influencer=influencer)
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
