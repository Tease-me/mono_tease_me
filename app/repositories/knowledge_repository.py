"""Repository for local influencer knowledge persistence."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import InfluencerKnowledgeChunk, InfluencerKnowledgeDocument
from app.services.embeddings import get_embeddings_batch
from app.services.knowledge_rag import chunk_text


def _normalize_text(raw_text: str) -> str:
    return (raw_text or "").strip()


def compute_text_hash(raw_text: str) -> str:
    return hashlib.sha256(raw_text.encode("utf-8")).hexdigest()


async def get_document(db: AsyncSession, influencer_id: str) -> InfluencerKnowledgeDocument | None:
    res = await db.execute(
        select(InfluencerKnowledgeDocument).where(
            InfluencerKnowledgeDocument.influencer_id == influencer_id
        )
    )
    return res.scalar_one_or_none()


async def get_document_with_count(
    db: AsyncSession,
    influencer_id: str,
) -> tuple[InfluencerKnowledgeDocument | None, int]:
    document = await get_document(db, influencer_id)
    if document is None:
        return None, 0

    count_res = await db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM influencer_knowledge_chunks
            WHERE influencer_id = :influencer_id
            """
        ),
        {"influencer_id": influencer_id},
    )
    return document, int(count_res.scalar() or 0)


async def upsert_document_and_chunks(
    db: AsyncSession,
    influencer_id: str,
    raw_text: str,
) -> tuple[InfluencerKnowledgeDocument, int]:
    normalized = _normalize_text(raw_text)
    if not normalized:
        raise ValueError("Knowledge text must not be empty")

    chunks = chunk_text(normalized)
    if not chunks:
        raise ValueError("Knowledge text produced no chunks")

    embeddings = await get_embeddings_batch(chunks)
    if len(embeddings) != len(chunks):
        raise RuntimeError("Embedding count mismatch while indexing knowledge chunks")
    if any(not emb for emb in embeddings):
        raise RuntimeError("Failed to embed one or more knowledge chunks")

    now = datetime.now(timezone.utc)
    text_hash = compute_text_hash(normalized)

    document = await get_document(db, influencer_id)
    if document is None:
        document = InfluencerKnowledgeDocument(
            influencer_id=influencer_id,
            raw_text=normalized,
            text_hash=text_hash,
            created_at=now,
            updated_at=now,
        )
        db.add(document)
        await db.flush()
    else:
        document.raw_text = normalized
        document.text_hash = text_hash
        document.updated_at = now
        await db.execute(
            delete(InfluencerKnowledgeChunk).where(
                InfluencerKnowledgeChunk.document_id == document.id
            )
        )

    db.add_all(
        [
            InfluencerKnowledgeChunk(
                document_id=document.id,
                influencer_id=influencer_id,
                chunk_index=idx,
                content=chunk,
                embedding=embedding,
            )
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
    )
    await db.flush()
    return document, len(chunks)


async def delete_document_and_chunks(db: AsyncSession, influencer_id: str) -> bool:
    document = await get_document(db, influencer_id)
    if document is None:
        return False
    await db.delete(document)
    await db.flush()
    return True
