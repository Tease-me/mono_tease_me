"""Repository for influencer <-> ElevenLabs knowledge sync metadata."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import InfluencerKnowledgeSync


async def get_sync_record(db: AsyncSession, influencer_id: str) -> InfluencerKnowledgeSync | None:
    res = await db.execute(
        select(InfluencerKnowledgeSync).where(
            InfluencerKnowledgeSync.influencer_id == influencer_id
        )
    )
    return res.scalar_one_or_none()


async def upsert_sync_record(
    db: AsyncSession,
    influencer_id: str,
    eleven_document_id: str,
    eleven_document_name: str | None,
    eleven_document_type: str = "text",
) -> InfluencerKnowledgeSync:
    now = datetime.now(timezone.utc)
    row = await get_sync_record(db, influencer_id)
    if row is None:
        row = InfluencerKnowledgeSync(
            influencer_id=influencer_id,
            eleven_document_id=eleven_document_id,
            eleven_document_name=eleven_document_name,
            eleven_document_type=eleven_document_type,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.eleven_document_id = eleven_document_id
        row.eleven_document_name = eleven_document_name
        row.eleven_document_type = eleven_document_type
        row.updated_at = now
    await db.flush()
    return row


async def delete_sync_record(db: AsyncSession, influencer_id: str) -> bool:
    row = await get_sync_record(db, influencer_id)
    if row is None:
        return False
    await db.delete(row)
    await db.flush()
    return True
