"""Influencer knowledge ingestion and retrieval for chat RAG."""

import hashlib
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import delete, select, text

from app.data.models import InfluencerKnowledgeChunk, InfluencerKnowledgeDocument
from app.services.embeddings import get_embeddings_batch

log = logging.getLogger(__name__)


def _normalize_text(raw_text: str) -> str:
    return (raw_text or "").strip()


def chunk_text(raw_text: str, target_chars: int = 700, overlap_chars: int = 120) -> list[str]:
    """Deterministically split text into overlapping chunks."""
    text_value = _normalize_text(raw_text)
    if not text_value:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", text_value)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sent = sentence.strip()
        if not sent:
            continue

        if len(sent) > target_chars:
            if current.strip():
                chunks.append(current.strip())
                current = ""
            start = 0
            step = max(1, target_chars - overlap_chars)
            while start < len(sent):
                piece = sent[start : start + target_chars].strip()
                if piece:
                    chunks.append(piece)
                start += step
            continue

        candidate = f"{current} {sent}".strip() if current else sent
        if len(candidate) <= target_chars:
            current = candidate
            continue

        if current:
            chunks.append(current.strip())
            overlap = current[-overlap_chars:].strip() if overlap_chars > 0 else ""
            current = f"{overlap} {sent}".strip() if overlap else sent
        else:
            chunks.append(sent)
            current = ""

    if current.strip():
        chunks.append(current.strip())

    return [c for c in chunks if c.strip()]


async def get_influencer_knowledge_document(db, influencer_id: str) -> InfluencerKnowledgeDocument | None:
    result = await db.execute(
        select(InfluencerKnowledgeDocument).where(
            InfluencerKnowledgeDocument.influencer_id == influencer_id
        )
    )
    return result.scalar_one_or_none()


async def count_knowledge_chunks(db, influencer_id: str) -> int:
    result = await db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM influencer_knowledge_chunks
            WHERE influencer_id = :influencer_id
            """
        ),
        {"influencer_id": influencer_id},
    )
    return int(result.scalar() or 0)


async def upsert_influencer_knowledge(db, influencer_id: str, raw_text: str) -> tuple[InfluencerKnowledgeDocument, int]:
    """Upsert one knowledge document and atomically rebuild all chunks."""
    normalized_text = _normalize_text(raw_text)
    if not normalized_text:
        raise ValueError("Knowledge text must not be empty")

    chunks = chunk_text(normalized_text)
    if not chunks:
        raise ValueError("Knowledge text produced no chunks")

    embeddings = await get_embeddings_batch(chunks)
    if len(embeddings) != len(chunks):
        raise RuntimeError("Embedding count mismatch while indexing knowledge chunks")
    if any(not emb for emb in embeddings):
        raise RuntimeError("Failed to embed one or more knowledge chunks")

    text_hash = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
    document = await get_influencer_knowledge_document(db, influencer_id)
    now = datetime.now(timezone.utc)

    if document is None:
        document = InfluencerKnowledgeDocument(
            influencer_id=influencer_id,
            raw_text=normalized_text,
            text_hash=text_hash,
            created_at=now,
            updated_at=now,
        )
        db.add(document)
        await db.flush()
    else:
        if document.text_hash == text_hash:
            existing_count = await count_knowledge_chunks(db, influencer_id)
            if existing_count > 0:
                return document, existing_count
        document.raw_text = normalized_text
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
    await db.commit()
    await db.refresh(document)

    chunk_count = len(chunks)
    log.info(
        "knowledge_upsert influencer_id=%s doc_id=%s chunks=%d",
        influencer_id,
        document.id,
        chunk_count,
    )
    return document, chunk_count


async def retrieve_knowledge_chunks(
    db,
    influencer_id: str,
    query_embedding: list[float] | None,
    top_k: int = 5,
) -> list[str]:
    """Retrieve top-k knowledge chunks for one influencer by cosine similarity."""
    if not query_embedding:
        return []

    result = await db.execute(
        text(
            """
            SELECT content
            FROM influencer_knowledge_chunks
            WHERE influencer_id = :influencer_id
            ORDER BY embedding <=> :embedding
            LIMIT :top_k
            """
        ),
        {
            "influencer_id": influencer_id,
            "embedding": "[" + ",".join(str(x) for x in query_embedding) + "]",
            "top_k": int(top_k),
        },
    )
    return [row[0] for row in result.fetchall() if isinstance(row[0], str) and row[0].strip()]


async def delete_influencer_knowledge(db, influencer_id: str) -> bool:
    """Delete influencer knowledge document (chunk rows cascade)."""
    document = await get_influencer_knowledge_document(db, influencer_id)
    if not document:
        return False

    await db.delete(document)
    await db.commit()
    return True
