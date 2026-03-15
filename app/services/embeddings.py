"""
Embedding and vector search service for AI-powered memory and message retrieval.

This module provides:
- OpenAI text embeddings generation (single and batch)
- Vector similarity search for memories and messages
- Memory upsert with deduplication based on semantic similarity
"""

import logging
import time

from openai import AsyncOpenAI
from sqlalchemy import text
from app.core.config import settings

log = logging.getLogger(__name__)

# Use AsyncOpenAI for non-blocking API calls
# This prevents blocking the event loop during embedding requests
client = AsyncOpenAI()

backup_client = AsyncOpenAI(
    api_key=settings.QWEN_API_KEY,
    base_url=settings.QWEN_BASE_URL
) if settings.QWEN_API_KEY else None


async def get_embedding(text: str) -> list[float]:
    """
    Get embedding for a single text (non-blocking).
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector as list of floats
    """
    try:
        t0 = time.perf_counter()
        response = await client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        emb_ms = int((time.perf_counter() - t0) * 1000)
        tokens_used = getattr(response, 'usage', None)
        from app.services.token_tracker import track_usage_bg
        track_usage_bg(
            "embedding", "openai", "text-embedding-3-small", "embedding",
            input_tokens=getattr(tokens_used, 'total_tokens', None) if tokens_used else None,
            latency_ms=emb_ms,
        )
        return response.data[0].embedding
    except Exception as e:
        log.warning("Primary embedding failed, trying fallback: %s", e)
        if backup_client:
            t0 = time.perf_counter()
            response = await backup_client.embeddings.create(
                input=text,
                model="text-embedding-v3",
                dimensions=1536
            )
            emb_ms = int((time.perf_counter() - t0) * 1000)
            tokens_used = getattr(response, 'usage', None)
            from app.services.token_tracker import track_usage_bg
            track_usage_bg(
                "embedding", "alibaba", "text-embedding-v3", "embedding",
                input_tokens=getattr(tokens_used, 'total_tokens', None) if tokens_used else None,
                latency_ms=emb_ms,
            )
            return response.data[0].embedding
        raise


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Get embeddings for multiple texts in a single API call.
    
    This is much more efficient than calling get_embedding() in a loop:
    - 1 API call instead of N
    - ~70-80% latency reduction for multiple texts
    - Non-blocking: doesn't block event loop during API call
    
    Args:
        texts: List of texts to embed (max ~2000 recommended per batch)
        
    Returns:
        List of embeddings in the same order as input texts
    """
    if not texts:
        return []
    
    if len(texts) == 1:
        # Single text - use regular function
        return [await get_embedding(texts[0])]
    
    try:
        t0 = time.perf_counter()
        response = await client.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )
        emb_ms = int((time.perf_counter() - t0) * 1000)
        tokens_used = getattr(response, 'usage', None)
        from app.services.token_tracker import track_usage_bg
        track_usage_bg(
            "embedding", "openai", "text-embedding-3-small", "embedding_batch",
            input_tokens=getattr(tokens_used, 'total_tokens', None) if tokens_used else None,
            latency_ms=emb_ms,
        )
        # API returns embeddings in order, but let's be safe
        # Sort by index to ensure order matches input
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
    except Exception as e:
        log.error("Batch embedding failed: %s", e)
        if backup_client:
            try:
                t0 = time.perf_counter()
                response = await backup_client.embeddings.create(
                    input=texts,
                    model="text-embedding-v3",
                    dimensions=1536
                )
                emb_ms = int((time.perf_counter() - t0) * 1000)
                tokens_used = getattr(response, 'usage', None)
                from app.services.token_tracker import track_usage_bg
                track_usage_bg(
                    "embedding", "alibaba", "text-embedding-v3", "embedding_batch",
                    input_tokens=getattr(tokens_used, 'total_tokens', None) if tokens_used else None,
                    latency_ms=emb_ms,
                )
                sorted_data = sorted(response.data, key=lambda x: x.index)
                return [item.embedding for item in sorted_data]
            except Exception as backup_e:
                log.error("Backup batch embedding failed: %s", backup_e)
        
        # Fallback: try one at a time
        embeddings = []
        for text in texts:
            try:
                emb = await get_embedding(text)
                embeddings.append(emb)
            except Exception as inner_e:
                log.error("Single embedding fallback failed for text: %s", inner_e)
                embeddings.append([])  # Empty embedding on failure
        return embeddings


async def search_similar_memories(db, chat_id: str, embedding: list[float], top_k: int = 10, max_distance: float | None = None, created_after: str | None = None, user_timezone: str | None = None, days_back: int = 30) -> list[tuple[str, str]]:
    """
    Search for similar memories using vector similarity with cosine distance.

    Orders by similarity first (most relevant), then by recency (created_at DESC) as a tiebreaker.
    Returns memories from the last N days (default 30) in user's timezone.

    Args:
        db: Database session
        chat_id: Chat ID to search within
        embedding: Query embedding vector
        top_k: Number of results to return (default: 10)
        max_distance: Optional maximum cosine distance threshold (default: None = no filtering)
                     Lower = more similar (0=identical, 1=orthogonal)
                     Recommended: 0.3-0.7 for filtering
        created_after: Optional ISO timestamp to filter memories (default: N days ago in user's TZ)
                      Prevents retrieving very stale memories
        user_timezone: User's timezone (e.g., "America/New_York"). If provided, calculates
                      date boundary in user's timezone. If None, defaults to UTC.
        days_back: How many days back to search (default 30). Set to 1 for today only.

    Returns:
        List of (content, sender, created_at) tuples ordered by similarity, then recency
    """
    # Default to N days ago in user's timezone if not specified
    if created_after is None:
        from datetime import datetime, timezone as dt_tz, timedelta
        from zoneinfo import ZoneInfo

        if user_timezone:
            try:
                tz = ZoneInfo(user_timezone)
                cutoff = datetime.now(tz) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
            except Exception:
                # Fallback to UTC if timezone is invalid
                cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
            cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)

        created_after = cutoff.isoformat()

    if max_distance is not None:
        sql = text("""
            SELECT content, sender, created_at, embedding <=> :embedding AS distance
            FROM memories
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND embedding <=> :embedding <= :max_distance
              AND created_at >= :created_after
            ORDER BY distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "max_distance": max_distance,
            "created_after": created_after
        }
    else:
        sql = text("""
            SELECT content, sender, created_at
            FROM memories
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND created_at >= :created_after
            ORDER BY embedding <=> :embedding, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "created_after": created_after
        }

    result = await db.execute(sql, params)
    return [(row[0], row[1] or "user", row[2]) for row in result.fetchall()]


async def search_similar_messages(db, chat_id: str, embedding: list[float], top_k: int = 10, max_distance: float | None = None, created_after: str | None = None, user_timezone: str | None = None, days_back: int = 30) -> list[tuple[str, str | None]]:
    """
    Search for similar messages using vector similarity with cosine distance.

    Orders by similarity first (most relevant), then by recency (created_at DESC) as a tiebreaker.
    Returns messages from the last N days (default 30) in user's timezone.

    Args:
        db: Database session
        chat_id: Chat ID to search within
        embedding: Query embedding vector
        top_k: Number of results to return (default: 10)
        max_distance: Optional maximum cosine distance threshold (default: None = no filtering)
                     Lower = more similar (0=identical, 1=orthogonal)
                     Recommended: 0.3-0.7 for filtering
        created_after: Optional ISO timestamp to filter messages (default: N days ago in user's TZ)
                      Prevents retrieving very stale messages
        user_timezone: User's timezone (e.g., "America/New_York"). If provided, calculates
                      date boundary in user's timezone. If None, defaults to UTC.
        days_back: How many days back to search (default 30). Set to 1 for today only.

    Returns:
        List of (message_content, created_at) tuples ordered by similarity, then recency
    """
    # Default to N days ago in user's timezone if not specified
    if created_after is None:
        from datetime import datetime, timezone as dt_tz, timedelta
        from zoneinfo import ZoneInfo

        if user_timezone:
            try:
                tz = ZoneInfo(user_timezone)
                cutoff = datetime.now(tz) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
            except Exception:
                # Fallback to UTC if timezone is invalid
                cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
            cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)

        created_after = cutoff.isoformat()

    if max_distance is not None:
        sql = text("""
            SELECT content, created_at, embedding <=> :embedding AS distance
            FROM messages
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND embedding <=> :embedding <= :max_distance
              AND created_at >= :created_after
            ORDER BY distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "max_distance": max_distance,
            "created_after": created_after
        }
    else:
        sql = text("""
            SELECT content, created_at
            FROM messages
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND created_at >= :created_after
            ORDER BY embedding <=> :embedding, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "created_after": created_after
        }

    result = await db.execute(sql, params)
    return [(row[0], row[1]) for row in result.fetchall()]


async def search_similar_memories_and_messages(
    db,
    chat_id: str,
    embedding: list[float],
    top_k: int = 10,
    max_distance: float | None = None,
    memories_weight: float = 1.0,
    messages_weight: float = 1.0,
    created_after: str | None = None,
    user_timezone: str | None = None,
    days_back: int = 30,
) -> list[tuple[str, str | None]]:
    """
    Search for similar content across BOTH memories and messages using UNION.

    This combines results from both tables, allowing you to get a richer context
    by including both curated memories (facts) and actual conversation history.
    Returns content from the last N days (default 30) in user's timezone.

    Args:
        db: Database session
        chat_id: Chat ID to search within
        embedding: Query embedding vector
        top_k: Number of results to return (default: 10)
        max_distance: Optional maximum cosine distance threshold (default: None = no filtering)
                     Lower = more similar (0=identical, 1=orthogonal)
                     Recommended: 0.3-0.7 for filtering
        memories_weight: Weight multiplier for memory distances (default: 1.0)
                        Lower = prioritize memories (e.g., 0.8 gives memories 20% boost)
        messages_weight: Weight multiplier for message distances (default: 1.0)
                        Lower = prioritize messages (e.g., 0.9 gives messages 10% boost)
        created_after: Optional ISO timestamp to filter memories/messages (default: N days ago in user's TZ)
                      Prevents retrieving very stale content
        user_timezone: User's timezone (e.g., "America/New_York"). If provided, calculates
                      date boundary in user's timezone. If None, defaults to UTC.
        days_back: How many days back to search (default 30). Set to 1 for today only.

    Returns:
        List of (content, created_at) tuples ordered by weighted similarity

    Example:
        # Prioritize memories slightly over messages
        results = await search_similar_memories_and_messages(
            db, chat_id, embedding, top_k=10,
            memories_weight=0.8, messages_weight=1.0
        )
    """
    # Default to N days ago in user's timezone if not specified
    if created_after is None:
        from datetime import datetime, timezone as dt_tz, timedelta
        from zoneinfo import ZoneInfo

        if user_timezone:
            try:
                tz = ZoneInfo(user_timezone)
                cutoff = datetime.now(tz) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
            except Exception:
                # Fallback to UTC if timezone is invalid
                cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
                cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            cutoff = datetime.now(dt_tz.utc) - timedelta(days=days_back)
            cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)

        created_after = cutoff.isoformat()

    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    if max_distance is not None:
        sql = text("""
            SELECT content, created_at, weighted_distance, source
            FROM (
                SELECT
                    content,
                    (embedding <=> :embedding) * :memories_weight AS weighted_distance,
                    'memory' AS source,
                    created_at
                FROM memories
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
                  AND (embedding <=> :embedding) * :memories_weight <= :max_distance
                  AND created_at >= :created_after

                UNION ALL

                SELECT
                    content,
                    (embedding <=> :embedding) * :messages_weight AS weighted_distance,
                    'message' AS source,
                    created_at
                FROM messages
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
                  AND (embedding <=> :embedding) * :messages_weight <= :max_distance
                  AND created_at >= :created_after
            ) combined
            ORDER BY weighted_distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": embedding_str,
            "top_k": top_k,
            "max_distance": max_distance,
            "memories_weight": memories_weight,
            "messages_weight": messages_weight,
            "created_after": created_after,
        }
    else:
        sql = text("""
            SELECT content, created_at, weighted_distance, source
            FROM (
                SELECT
                    content,
                    (embedding <=> :embedding) * :memories_weight AS weighted_distance,
                    'memory' AS source,
                    created_at
                FROM memories
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
                  AND created_at >= :created_after

                UNION ALL

                SELECT
                    content,
                    (embedding <=> :embedding) * :messages_weight AS weighted_distance,
                    'message' AS source,
                    created_at
                FROM messages
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
                  AND created_at >= :created_after
            ) combined
            ORDER BY weighted_distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": embedding_str,
            "top_k": top_k,
            "memories_weight": memories_weight,
            "messages_weight": messages_weight,
            "created_after": created_after,
        }

    result = await db.execute(sql, params)
    return [(row[0], row[1]) for row in result.fetchall()]


async def upsert_memory(
    db,
    chat_id: str,
    content: str,
    embedding: list[float],
    sender: str = "fact",
    similarity_threshold: float = 0.25,
) -> str | None:
    """
    Insert or update a memory based on semantic similarity using cosine distance.
    
    If a similar memory already exists (within similarity_threshold), it will be updated.
    Otherwise, a new memory is inserted.
    
    Args:
        db: Database session
        chat_id: Chat ID
        content: Memory content
        embedding: Content embedding vector
        sender: Sender identifier (default: "fact")
        similarity_threshold: Maximum cosine distance for considering memories similar (default: 0.25)
                             Lower = stricter matching (0=identical, 1=orthogonal)
        
    Returns:
        "update" if existing memory was updated, "insert" if new memory created, None on error
    """
    try:
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        # 1. Search for similar memory (prefer most similar, then most recent), restricting search to the same sender type
        sql_find = text("""
            SELECT id, embedding <=> :embedding AS similarity
            FROM memories
            WHERE chat_id = :chat_id
              AND sender = :sender
              AND embedding IS NOT NULL
            ORDER BY similarity ASC, created_at DESC
            LIMIT 1
        """)
        params_find = {
            "chat_id": chat_id,
            "sender": sender,
            "embedding": embedding_str,
        }
        result = await db.execute(sql_find, params_find)
        similar = result.fetchone()

        if similar and similar[1] <= similarity_threshold:
            # Update existing similar memory
            sql_update = text("""
                UPDATE memories
                SET content = :content, embedding = :embedding, sender = :sender, created_at = NOW()
                WHERE id = :id
            """)
            params_update = {
                "id": similar[0],
                "content": content,
                "embedding": embedding_str,
                "sender": sender,
            }
            await db.execute(sql_update, params_update)
            result_action = "update"
        else:
            # Insert as a new memory
            sql_insert = text("""
                INSERT INTO memories (chat_id, content, embedding, sender, created_at)
                VALUES (:chat_id, :content, :embedding, :sender, NOW())
            """)
            params_insert = {
                "chat_id": chat_id,
                "content": content,
                "embedding": embedding_str,
                "sender": sender,
            }
            await db.execute(sql_insert, params_insert)
            result_action = "insert"

        await db.commit()
        return result_action
    except Exception as e:
        await db.rollback()
        log.error(f"Failed to upsert memory for chat_id={chat_id}: {e}", exc_info=True)
        return None
