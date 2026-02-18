"""
Embedding and vector search service for AI-powered memory and message retrieval.

This module provides:
- OpenAI text embeddings generation (single and batch)
- Vector similarity search for memories and messages
- Memory upsert with deduplication based on semantic similarity
"""

import logging

from openai import AsyncOpenAI
from sqlalchemy import text

log = logging.getLogger(__name__)

# Use AsyncOpenAI for non-blocking API calls
# This prevents blocking the event loop during embedding requests
client = AsyncOpenAI()


async def get_embedding(text: str) -> list[float]:
    """
    Get embedding for a single text (non-blocking).
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector as list of floats
    """
    response = await client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding


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
        response = await client.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )
        # API returns embeddings in order, but let's be safe
        # Sort by index to ensure order matches input
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
    except Exception as e:
        log.error("Batch embedding failed: %s", e, exc_info=True)
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


async def search_similar_memories(db, chat_id: str, embedding: list[float], top_k: int = 10, max_distance: float | None = None) -> list[str]:
    """
    Search for similar memories using vector similarity with cosine distance.
    
    Orders by similarity first (most relevant), then by recency (created_at DESC) as a tiebreaker.
    
    Args:
        db: Database session
        chat_id: Chat ID to search within
        embedding: Query embedding vector
        top_k: Number of results to return (default: 10)
        max_distance: Optional maximum cosine distance threshold (default: None = no filtering)
                     Lower = more similar (0=identical, 1=orthogonal)
                     Recommended: 0.3-0.7 for filtering
        
    Returns:
        List of memory content strings ordered by similarity, then recency
    """
    if max_distance is not None:
        sql = text("""
            SELECT content, embedding <=> :embedding AS distance
            FROM memories
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND embedding <=> :embedding <= :max_distance
            ORDER BY distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "max_distance": max_distance
        }
    else:
        sql = text("""
            SELECT content
            FROM memories
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k
        }
    
    result = await db.execute(sql, params)
    return [row[0] for row in result.fetchall()]


async def search_similar_messages(db, chat_id: str, embedding: list[float], top_k: int = 10, max_distance: float | None = None) -> list[str]:
    """
    Search for similar messages using vector similarity with cosine distance.
    
    Orders by similarity first (most relevant), then by recency (created_at DESC) as a tiebreaker.
    
    Args:
        db: Database session
        chat_id: Chat ID to search within
        embedding: Query embedding vector
        top_k: Number of results to return (default: 10)
        max_distance: Optional maximum cosine distance threshold (default: None = no filtering)
                     Lower = more similar (0=identical, 1=orthogonal)
                     Recommended: 0.3-0.7 for filtering
        
    Returns:
        List of message content strings ordered by similarity, then recency
    """
    if max_distance is not None:
        sql = text("""
            SELECT content, embedding <=> :embedding AS distance
            FROM messages
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
              AND embedding <=> :embedding <= :max_distance
            ORDER BY distance ASC, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k,
            "max_distance": max_distance
        }
    else:
        sql = text("""
            SELECT content
            FROM messages
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding, created_at DESC
            LIMIT :top_k
        """)
        params = {
            "chat_id": chat_id,
            "embedding": "[" + ",".join(str(x) for x in embedding) + "]",
            "top_k": top_k
        }
    
    result = await db.execute(sql, params)
    return [row[0] for row in result.fetchall()]


async def search_similar_memories_and_messages(
    db, 
    chat_id: str, 
    embedding: list[float], 
    top_k: int = 10, 
    max_distance: float | None = None,
    memories_weight: float = 1.0,
    messages_weight: float = 1.0,
) -> list[str]:
    """
    Search for similar content across BOTH memories and messages using UNION.
    
    This combines results from both tables, allowing you to get a richer context
    by including both curated memories (facts) and actual conversation history.
    
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
        
    Returns:
        List of content strings (both memories and messages) ordered by weighted similarity
        
    Example:
        # Prioritize memories slightly over messages
        results = await search_similar_memories_and_messages(
            db, chat_id, embedding, top_k=10, 
            memories_weight=0.8, messages_weight=1.0
        )
    """
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    
    if max_distance is not None:
        sql = text("""
            SELECT content, weighted_distance, source
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
        }
    else:
        sql = text("""
            SELECT content, weighted_distance, source
            FROM (
                SELECT 
                    content,
                    (embedding <=> :embedding) * :memories_weight AS weighted_distance,
                    'memory' AS source,
                    created_at
                FROM memories
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
                
                UNION ALL
                
                SELECT 
                    content,
                    (embedding <=> :embedding) * :messages_weight AS weighted_distance,
                    'message' AS source,
                    created_at
                FROM messages
                WHERE chat_id = :chat_id
                  AND embedding IS NOT NULL
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
        }
    
    result = await db.execute(sql, params)
    return [row[0] for row in result.fetchall()]


async def upsert_memory(
    db,
    chat_id: str,
    content: str,
    embedding: list[float],
    sender: str = "fact",
    similarity_threshold: float = 0.15,
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
        similarity_threshold: Maximum cosine distance for considering memories similar (default: 0.15)
                             Lower = stricter matching (0=identical, 1=orthogonal)
        
    Returns:
        "update" if existing memory was updated, "insert" if new memory created, None on error
    """
    try:
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        # 1. Search for similar memory (prefer most similar, then most recent)
        sql_find = text("""
            SELECT id, embedding <=> :embedding AS similarity
            FROM memories
            WHERE chat_id = :chat_id
              AND embedding IS NOT NULL
            ORDER BY similarity ASC, created_at DESC
            LIMIT 1
        """)
        params_find = {
            "chat_id": chat_id,
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
