"""Use-cases for remote-first knowledge sync and local persistence."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Influencer
from app.errors.knowledge_errors import (
    KnowledgeNotFoundError,
    KnowledgePersistenceError,
    KnowledgeSyncError,
    KnowledgeValidationError,
)
from app.gateways.elevenlabs_knowledge_gateway import ElevenLabsKnowledgeGateway
from app.repositories.knowledge_repository import (
    delete_document_and_chunks,
    get_document_with_count,
    upsert_document_and_chunks,
)
from app.repositories.knowledge_sync_repository import (
    delete_sync_record,
    get_sync_record,
    upsert_sync_record,
)
from app.schemas.knowledge import KnowledgeDeleteResult, KnowledgeUpsertInput, KnowledgeUpsertResult

log = logging.getLogger(__name__)


def _managed_doc_name(influencer_id: str) -> str:
    return f"teaseme-kb-{influencer_id}"


def _doc_id(item: dict) -> str | None:
    value = item.get("id") or item.get("document_id")
    return str(value) if value is not None else None


def _normalize_kb_item(doc_id: str, doc_name: str, doc_type: str = "text") -> dict:
    return {"type": doc_type, "name": doc_name, "id": doc_id, "usage_mode": "auto"}


def _replace_doc(items: list[dict], old_doc_id: str | None, new_item: dict) -> list[dict]:
    updated: list[dict] = []
    for item in items:
        existing_id = _doc_id(item)
        if old_doc_id and existing_id == old_doc_id:
            continue
        if existing_id == new_item["id"]:
            continue
        updated.append(item)
    updated.append(new_item)
    return updated


def _remove_doc(items: list[dict], target_doc_id: str | None, influencer_id: str) -> list[dict]:
    managed_prefix = _managed_doc_name(influencer_id)
    updated: list[dict] = []
    for item in items:
        existing_id = _doc_id(item)
        existing_name = str(item.get("name") or "")
        if target_doc_id and existing_id == target_doc_id:
            continue
        if existing_name.startswith(managed_prefix):
            continue
        updated.append(item)
    return updated


async def get_knowledge_for_admin(
    db: AsyncSession,
    influencer_id: str,
) -> tuple[int, str, str | None, int, str | None, str | None]:
    document, chunk_count = await get_document_with_count(db, influencer_id)
    if not document:
        raise KnowledgeNotFoundError("Knowledge not found for influencer")
    sync_row = await get_sync_record(db, influencer_id)
    return (
        document.id,
        document.raw_text,
        document.text_hash,
        chunk_count,
        document.updated_at.isoformat() if document.updated_at else None,
        sync_row.eleven_document_id if sync_row else None,
    )


async def upsert_knowledge_remote_first(
    db: AsyncSession,
    influencer: Influencer,
    payload: KnowledgeUpsertInput,
) -> KnowledgeUpsertResult:
    text_value = (payload.text or "").strip()
    if not text_value:
        raise KnowledgeValidationError("Knowledge text must not be empty")

    agent_id = getattr(influencer, "influencer_agent_id_third_part", None)
    if not agent_id:
        raise KnowledgeValidationError("Influencer is missing ElevenLabs agent id")

    gateway = ElevenLabsKnowledgeGateway()
    sync_row = await get_sync_record(db, influencer.id)
    old_doc_id = sync_row.eleven_document_id if sync_row else None
    agent_snapshot = await gateway.get_agent(agent_id)
    old_items = agent_snapshot["knowledge_base"]
    branch_id = agent_snapshot.get("branch_id")

    created_doc = await gateway.create_text_document(
        text_value=text_value,
        name=_managed_doc_name(influencer.id),
    )
    new_item = _normalize_kb_item(
        doc_id=created_doc["id"],
        doc_name=created_doc["name"],
        doc_type=created_doc.get("type", "text"),
    )
    new_items = _replace_doc(old_items, old_doc_id, new_item)

    try:
        used_branch_id = await gateway.set_agent_knowledge_base(
            agent_id,
            new_items,
            fetched_branch_id=branch_id,
            verify_doc_id=created_doc["id"],
            expect_present=True,
        )
        log.info(
            "knowledge_sync.agent_attach_verified influencer_id=%s agent_id=%s branch_id=%s doc_id=%s verify_result=success",
            influencer.id,
            agent_id,
            used_branch_id,
            created_doc["id"],
        )
    except Exception as exc:
        log.error(
            "knowledge_sync.agent_attach_failed influencer_id=%s agent_id=%s branch_id=%s doc_id=%s err=%s",
            influencer.id,
            agent_id,
            branch_id,
            created_doc["id"],
            exc,
        )
        await gateway.safe_delete_document(created_doc.get("id"))
        raise

    try:
        document, chunk_count = await upsert_document_and_chunks(
            db=db,
            influencer_id=influencer.id,
            raw_text=text_value,
        )
        await upsert_sync_record(
            db=db,
            influencer_id=influencer.id,
            eleven_document_id=created_doc["id"],
            eleven_document_name=created_doc.get("name"),
            eleven_document_type=created_doc.get("type", "text"),
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        try:
            await gateway.set_agent_knowledge_base(
                agent_id,
                old_items,
                fetched_branch_id=branch_id,
            )
        except Exception as rollback_exc:
            log.error(
                "knowledge_sync.rollback_agent_failed influencer=%s err=%s",
                influencer.id,
                rollback_exc,
            )
        await gateway.safe_delete_document(created_doc.get("id"))
        raise KnowledgePersistenceError(f"Failed to persist knowledge after remote sync: {exc}") from exc

    if old_doc_id and old_doc_id != created_doc["id"]:
        await gateway.safe_delete_document(old_doc_id)

    return KnowledgeUpsertResult(
        influencer_id=influencer.id,
        document_id=document.id,
        chunk_count=chunk_count,
        updated_at=document.updated_at.isoformat() if document.updated_at else None,
        remote_document_id=created_doc["id"],
    )


async def delete_knowledge_remote_first(
    db: AsyncSession,
    influencer: Influencer,
) -> KnowledgeDeleteResult:
    agent_id = getattr(influencer, "influencer_agent_id_third_part", None)
    if not agent_id:
        raise KnowledgeValidationError("Influencer is missing ElevenLabs agent id")

    gateway = ElevenLabsKnowledgeGateway()
    sync_row = await get_sync_record(db, influencer.id)
    old_doc_id = sync_row.eleven_document_id if sync_row else None
    agent_snapshot = await gateway.get_agent(agent_id)
    old_items = agent_snapshot["knowledge_base"]
    branch_id = agent_snapshot.get("branch_id")
    new_items = _remove_doc(old_items, old_doc_id, influencer.id)

    try:
        used_branch_id = await gateway.set_agent_knowledge_base(
            agent_id,
            new_items,
            fetched_branch_id=branch_id,
            verify_doc_id=old_doc_id,
            expect_present=False,
        )
        log.info(
            "knowledge_sync.agent_detach_verified influencer_id=%s agent_id=%s branch_id=%s doc_id=%s verify_result=success",
            influencer.id,
            agent_id,
            used_branch_id,
            old_doc_id,
        )
    except Exception as exc:
        raise KnowledgeSyncError(f"Failed to remove knowledge from ElevenLabs agent: {exc}") from exc

    try:
        deleted = await delete_document_and_chunks(db, influencer.id)
        if not deleted:
            await db.rollback()
            try:
                await gateway.set_agent_knowledge_base(
                    agent_id,
                    old_items,
                    fetched_branch_id=branch_id,
                )
            except Exception as rollback_exc:
                log.error(
                    "knowledge_sync.not_found_rollback_failed influencer=%s err=%s",
                    influencer.id,
                    rollback_exc,
                )
            raise KnowledgeNotFoundError("Knowledge not found for influencer")

        await delete_sync_record(db, influencer.id)
        await db.commit()
    except Exception as exc:
        if isinstance(exc, KnowledgeNotFoundError):
            raise
        await db.rollback()
        try:
            await gateway.set_agent_knowledge_base(
                agent_id,
                old_items,
                fetched_branch_id=branch_id,
            )
        except Exception as rollback_exc:
            log.error(
                "knowledge_sync.delete_rollback_failed influencer=%s err=%s",
                influencer.id,
                rollback_exc,
            )
        raise KnowledgePersistenceError(f"Failed to delete local knowledge after remote sync: {exc}") from exc

    if old_doc_id:
        await gateway.safe_delete_document(old_doc_id)

    return KnowledgeDeleteResult(
        influencer_id=influencer.id,
        deleted=True,
    )
