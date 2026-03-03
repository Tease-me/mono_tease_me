from app.services.embeddings import get_embedding, get_embeddings_batch, search_similar_memories, search_similar_messages, search_similar_memories_and_messages, upsert_memory
from sqlalchemy import select, union_all
from sqlalchemy.sql import func
from app.db.models import Memory, Chat, Message
from langchain_core.prompts import ChatPromptTemplate
from langchain_xai import ChatXAI
from app.core.config import settings
import logging
from app.db.session import SessionLocal
from app.agents.callbacks import UsageTrackingCallback

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tunables for transcript → memory extraction
# ---------------------------------------------------------------------------
_CHUNK_SIZE = 14          # turns per LLM chunk (↓ = more calls, ↑ = cheaper)
_CHUNK_OVERLAP_TURNS = 4  # context overlap between chunks


async def extract_memories_from_transcript(
    chat_id: str,
    transcript_entries: list,
    conversation_id: str,
) -> None:
    from app.agents.prompts import FACT_EXTRACTOR, get_fact_prompt
    import asyncio
    import time as _time

    t0 = _time.perf_counter()

    all_turns = []
    for entry in transcript_entries:
        if isinstance(entry, dict):
            text = (entry.get("text") or entry.get("content") or entry.get("message") or "").strip()
            if text:
                sender = str(entry.get("sender") or entry.get("role") or "unknown").lower()
                all_turns.append({"sender": sender, "text": text})

    if not all_turns:
        log.info("[MEMORY-BG] no speech in transcript conv=%s", conversation_id)
        return

    # ── Large-chunk grouping (2-3 LLM calls instead of N/2) ──
    chunks: list[tuple[str, str]] = []
    for start in range(0, len(all_turns), _CHUNK_SIZE):
        msg_turns = all_turns[start : start + _CHUNK_SIZE]
        # Context = tail of the previous chunk (overlapping turns)
        ctx_start = max(0, start - _CHUNK_OVERLAP_TURNS)
        ctx_turns = all_turns[ctx_start:start] if start > 0 else []

        ctx_str = "\n".join(f"{t['sender']}: {t['text']}" for t in ctx_turns)
        msg_str = "\n".join(f"{t['sender']}: {t['text']}" for t in msg_turns)
        chunks.append((ctx_str, msg_str))

    log.info(
        "[MEMORY-BG] chunking transcript of %d turns into %d chunks conv=%s chat=%s",
        len(all_turns), len(chunks), conversation_id, chat_id,
    )

    async with SessionLocal() as db:
        try:
            fact_prompt = await get_fact_prompt(db)
            from datetime import datetime, timezone as _tz
            ts_now = datetime.now(_tz.utc).strftime("%Y-%m-%d %H:%M UTC")

            async def extract_chunk(ctx_str: str, msg_str: str):
                try:
                    tracker = UsageTrackingCallback(
                        category="extraction",
                        purpose="fact_extraction",
                        chat_id=chat_id,
                        conversation_id=conversation_id,
                    )
                    resp = await FACT_EXTRACTOR.ainvoke(
                        fact_prompt.format(msg=msg_str, ctx=ctx_str, ts=ts_now),
                        config={"callbacks": [tracker]}
                    )

                    txt = (resp.content or "").strip("- ").strip()
                    if txt and txt.lower() != "no new memories.":
                        lines = [ln.strip("- ").strip() for ln in txt.split("\n") if ln.strip()]
                        return [ln for ln in lines if ln.lower() != "no new memories."]
                except Exception as e:
                    log.warning("Chunk extraction failed: %s", e)
                return []

            # Concurrently extract from all chunks (typically 2-3 tasks)
            t_llm = _time.perf_counter()
            tasks = [extract_chunk(ctx, msg) for ctx, msg in chunks]
            extracted_results = await asyncio.gather(*tasks)
            llm_ms = int((_time.perf_counter() - t_llm) * 1000)

            # Flatten list of valid facts
            valid_facts = []
            for res_list in extracted_results:
                if res_list:
                    valid_facts.extend(res_list)

            if valid_facts:
                t_store = _time.perf_counter()
                stored = await store_facts_batch(db, chat_id, valid_facts)
                store_ms = int((_time.perf_counter() - t_store) * 1000)
                total_ms = int((_time.perf_counter() - t0) * 1000)
                log.info(
                    "[MEMORY-BG] done conv=%s chat=%s "
                    "chunks=%d llm_ms=%d stored=%d/%d store_ms=%d total_ms=%d",
                    conversation_id, chat_id,
                    len(chunks), llm_ms, stored, len(valid_facts), store_ms, total_ms,
                )
            else:
                total_ms = int((_time.perf_counter() - t0) * 1000)
                log.info(
                    "[MEMORY-BG] no new facts extracted conv=%s total_ms=%d",
                    conversation_id, total_ms,
                )

        except Exception as exc:
            log.error(
                "[MEMORY-BG] fact extraction failed conv=%s chat=%s err=%s",
                conversation_id, chat_id, exc, exc_info=True,
            )




async def summarize_memory_list(
    memories: list[str],
    max_items: int = 400,
) -> str:
    """
    Summarize a list of memory strings with LangChain.
    """
    if not memories:
        return "No memories available to summarize."



    selected = memories[:max_items]
    omitted = max(0, len(memories) - len(selected))
    memory_block = "\n".join(f"- {m}" for m in selected)
    if omitted:
        memory_block += f"\n- ... ({omitted} additional memory lines omitted for brevity)"

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You summarize relationship/chat memory logs for an AI persona. "
                "Current time: {current_time}. "
                "Use timestamps to include NATURAL relative time markers "
                "(e.g., 'just now', 'earlier today', 'recently', 'a few days ago', 'last week'). "
                "NEVER output raw dates or timestamps — translate them into natural relative language. "
                "Write as if naturally remembering, not citing records. "
                "Be concise, factual, and deeply analytical. Avoid hallucinations.",
            ),
            (
                "human",
                "Summarize these memories into the following ranked categories:\n"
                "1) **Most Important Recent Context** (Facts from the most recent session)\n"
                "2) **Evolving Relationship Dynamic & Core Facts** (Ongoing themes/preferences)\n"
                "3) **Top 3 Priorities for the AI** (Ranked 1 to 3 based on recent user behavior)\n"
                "4) **Dislikes/Boundaries** (What to never do)\n"
                "5) **One-paragraph Overall Summary**\n\n"
                "IMPORTANT: Use natural relative time language (e.g., 'just said', 'recently mentioned', "
                "'a while back') to convey recency. NEVER output raw dates or timestamps.\n\n"
                "Memories:\n{memory_block}",
            ),
        ]
    )
    llm = ChatXAI(
        xai_api_key=settings.XAI_API_KEY,
        model="grok-4-1-fast-non-reasoning",
        temperature=0.2,
        max_tokens=800,
    )
    chain = prompt | llm
    tracker = UsageTrackingCallback(
        category="analysis",
        purpose="summarize_memory",
    )
    from datetime import datetime, timezone
    resp = await chain.ainvoke(
        {
            "memory_block": memory_block, 
            "current_time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        },
        config={"callbacks": [tracker]}
    )

    return (resp.content or "").strip() or "(empty summary)"

async def summarize_ai_memory_list(
    memories: list[str],
    max_items: int = 400,
) -> str:
    """
    Summarize a list of AI memory strings into strategic behavioral categories.
    """
    if not memories:
        return "No AI decisions or promises recorded yet."

    selected = memories[:max_items]
    omitted = max(0, len(memories) - len(selected))
    memory_block = "\n".join(f"- {m}" for m in selected)
    if omitted:
        memory_block += f"\n- ... ({omitted} additional memory lines omitted for brevity)"

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You summarize an AI influencer's past actions, boundaries, and relationship decisions based on memory logs. "
                "Current time: {current_time}. "
                "Use timestamps to include NATURAL relative time markers "
                "(e.g., 'just now', 'earlier today', 'recently', 'a few days ago'). "
                "NEVER output raw dates or timestamps — translate them into natural relative language. "
                "Write as if naturally recalling past decisions, not citing records. "
                "Be incredibly concise, factual, and analytical. Speak in the third person about the AI (e.g. 'The AI promised...').",
            ),
            (
                "human",
                "Organize the AI's past decisions into the following critical categories:\n"
                "1) **Core Promises & Commitments** (What has the AI agreed to do?)\n"
                "2) **Current Persona Dynamic** (How is the AI prioritizing interactions towards the user?)\n"
                "3) **Open Teases / Unresolved Actions** (What cliffhangers or specific games are currently in play?)\n"
                "4) **Ranked Boundaries** (Top 3 strict 'NO' boundaries established by the AI)\n"
                "5) **One-paragraph Overall Stance** (A concise summary of how the AI should position itself right now)\n\n"
                "IMPORTANT: Use natural relative time language (e.g., 'just decided', 'recently promised') "
                "to convey recency. NEVER output raw dates or timestamps.\n\n"
                "AI Memories:\n{memory_block}",
            ),
        ]
    )
    llm = ChatXAI(
        xai_api_key=settings.XAI_API_KEY,
        model="grok-4-1-fast-non-reasoning",
        temperature=0.2,
        max_tokens=800,
    )
    chain = prompt | llm
    tracker = UsageTrackingCallback(
        category="analysis",
        purpose="summarize_ai_memory",
    )
    from datetime import datetime, timezone
    resp = await chain.ainvoke(
        {
            "memory_block": memory_block,
            "current_time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        },
        config={"callbacks": [tracker]}
    )

    return (resp.content or "").strip() or "(empty summary)"


async def get_summarized_memories(
    db,
    user_id: int,
    influencer_id: str,
    max_items: int = 400,
) -> str:
    """
    Fetch all memories for a user-influencer pair and return an LLM summary.
    """
    memories = await get_all_memory_list(db, user_id, influencer_id)
    return await summarize_memory_list(memories, max_items=max_items)


async def get_all_memory_list(
    db,
    user_id: int,
    influencer_id: str,
    exclude_sender: str = None,
    limit: int = 200,
) -> list[str]:
    """
    Return memory-related text for a user-influencer pair as a plain list[str].

    Combines:
    - Extracted long-term memories from `memories`
    - Chat messages from `messages`

    Ordered newest-first across both sources. Capped at `limit` rows.
    """
    chat_ids_res = await db.execute(
        select(Chat.id).where(
            Chat.user_id == user_id,
            Chat.influencer_id == influencer_id,
        )
    )
    chat_ids = list(chat_ids_res.scalars().all())
    if not chat_ids:
        return []

    memories_q = (
        select(
            Memory.content.label("content"),
            Memory.created_at.label("created_at"),
            Memory.id.label("row_id"),
        )
        .where(Memory.chat_id.in_(chat_ids))
    )
    if exclude_sender:
        memories_q = memories_q.where(Memory.sender != exclude_sender)

    messages_q = (
        select(
            Message.content.label("content"),
            Message.created_at.label("created_at"),
            Message.id.label("row_id"),
        )
        .where(Message.chat_id.in_(chat_ids))
    )

    combined = union_all(memories_q, messages_q).subquery("memory_timeline")
    timeline_q = (
        select(combined.c.created_at, combined.c.content)
        .order_by(combined.c.created_at.desc(), combined.c.row_id.desc())
        .limit(limit)
    )

    rows = await db.execute(timeline_q)
    result = []
    for (created_at, content) in rows.fetchall():
        if isinstance(content, str) and content.strip():
            ts_str = created_at.strftime('%Y-%m-%d %H:%M') if created_at else "UNKNOWN TIME"
            result.append(f"[{ts_str}] {content.strip()}")

    log.debug(
        "get_all_memory_list user=%s influencer=%s chats=%d items=%d",
        user_id,
        influencer_id,
        len(chat_ids),
        len(result),
    )
    return result


async def get_memory_only_list(
    db,
    user_id: int,
    influencer_id: str,
    exclude_sender: str = None,
    limit: int = 200,
) -> list[str]:
    """
    Return only curated memories (no raw messages) for a user-influencer pair.

    This is faster than `get_all_memory_list` because it skips the messages
    table entirely.  Since `upsert_memory` already deduplicates semantically
    similar facts, the memories table is a compact, high-quality dataset
    ideal for LLM summarization at call start.

    Ordered newest-first.  Capped at `limit` rows.
    """
    chat_ids_res = await db.execute(
        select(Chat.id).where(
            Chat.user_id == user_id,
            Chat.influencer_id == influencer_id,
        )
    )
    chat_ids = list(chat_ids_res.scalars().all())
    if not chat_ids:
        return []

    q = (
        select(Memory.created_at, Memory.content)
        .where(Memory.chat_id.in_(chat_ids))
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    if exclude_sender:
        q = q.where(Memory.sender != exclude_sender)

    rows = await db.execute(q)
    result = []
    for (created_at, content) in rows.fetchall():
        if isinstance(content, str) and content.strip():
            ts_str = created_at.strftime('%Y-%m-%d %H:%M') if created_at else "UNKNOWN TIME"
            result.append(f"[{ts_str}] {content.strip()}")

    log.debug(
        "get_memory_only_list user=%s influencer=%s chats=%d items=%d",
        user_id,
        influencer_id,
        len(chat_ids),
        len(result),
    )
    return result


async def find_similar_messages(
    db,
    chat_id: str,
    message: str,
    influencer_id: str = None,
    top_k: int = 10,
    embedding: list[float] | None = None,
    max_distance: float | None = None,
):
    """
    Find similar messages from chat history using semantic search.
    
    Args:
        db: Database session
        chat_id: ID of the chat
        message: User message to find similar messages for
        influencer_id: ID of the influencer (optional, for knowledge base search)
        top_k: Number of messages to return (default: 10)
        embedding: Optional precomputed embedding for the message (reuse to avoid duplicate calls)
        max_distance: Optional maximum cosine distance for relevance (default: None = no filtering)
    
    Returns:
        List of similar message content strings
    """
    emb = embedding or await get_embedding(message)
    
    chat_memories = await search_similar_messages(db, chat_id, emb, top_k=top_k, max_distance=max_distance)
    
    return chat_memories


async def find_similar_memories(
    db,
    chat_id: str,
    message: str,
    influencer_id: str = None,
    top_k: int = 10,
    embedding: list[float] | None = None,
    max_distance: float | None = None,
) -> dict[str, list[str]]:
    """
    Find similar memories using semantic search with improved accuracy.
    
    Args:
        db: Database session
        chat_id: ID of the chat
        message: User message to search memories for
        influencer_id: ID of the influencer (optional, for future use)
        top_k: Number of memories to return (default: 10)
        embedding: Optional precomputed embedding for the message (reuse to avoid duplicate calls)
        max_distance: Optional maximum cosine distance for relevance (default: None = no filtering)
                     Lower = stricter matching. Recommended: 0.3-0.7 if filtering
    
    Returns:
        Dict with 'user_memories' and 'ai_memories' lists
    """
    emb = embedding or await get_embedding(message)
    
    results = await search_similar_memories(db, chat_id, emb, top_k=top_k, max_distance=max_distance)

    user_memories = []
    ai_memories = []
    for content, sender in results:
        if sender == "system":
            ai_memories.append(content)
        else:
            user_memories.append(content)

    return {"user_memories": user_memories, "ai_memories": ai_memories}


async def find_similar_memories_and_messages(
    db,
    chat_id: str,
    message: str,
    influencer_id: str = None,
    top_k: int = 10,
    embedding: list[float] | None = None,
    max_distance: float | None = None,
    memories_weight: float = 1.0,
    messages_weight: float = 1.0,
):
    """
    Find similar content from BOTH memories and messages using UNION.
    
    This provides richer context by combining:
    - Curated memories (extracted facts)
    - Actual conversation history (messages)
    
    Args:
        db: Database session
        chat_id: ID of the chat
        message: User message to search for similar content
        influencer_id: ID of the influencer (optional, for future use)
        top_k: Number of results to return (default: 10)
        embedding: Optional precomputed embedding for the message (reuse to avoid duplicate calls)
        max_distance: Optional maximum cosine distance for relevance (default: None = no filtering)
        memories_weight: Weight for memory distances (default: 1.0, lower = higher priority)
        messages_weight: Weight for message distances (default: 1.0, lower = higher priority)
    
    Returns:
        List of similar content strings (both memories and messages) ordered by weighted similarity
        
    Example:
        # Prioritize memories over messages
        results = await find_similar_memories_and_messages(
            db, chat_id, "user text", 
            top_k=10,
            memories_weight=0.8,  # 20% boost to memories
            messages_weight=1.0
        )
    """
    emb = embedding or await get_embedding(message)
    
    combined_results = await search_similar_memories_and_messages(
        db, 
        chat_id, 
        emb, 
        top_k=top_k, 
        max_distance=max_distance,
        memories_weight=memories_weight,
        messages_weight=messages_weight,
    )

    return combined_results


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


async def _already_have(db, chat_id: str, fact: str) -> bool:
    """Check if the normalized fact already exists for this chat_id."""
    norm_fact = _norm(fact)
    result = await db.execute(
        select(Memory)
        .where(Memory.chat_id == chat_id)
        .where(func.lower(Memory.content) == norm_fact)
    )
    return result.scalar_one_or_none() is not None


async def _batch_already_have(db, chat_id: str, normalized_facts: list[str]) -> set[str]:
    """Return the set of normalized fact strings that already exist for this chat_id.

    Single DB round-trip instead of N sequential calls.
    """
    if not normalized_facts:
        return set()
    result = await db.execute(
        select(func.lower(Memory.content))
        .where(Memory.chat_id == chat_id)
        .where(func.lower(Memory.content).in_(normalized_facts))
    )
    return {row[0] for row in result.fetchall()}


async def store_fact(db, chat_id: str, fact: str, sender: str = "user"):
    """Store a single fact (legacy function for backward compatibility)."""
    norm_fact = _norm(fact)
    if not norm_fact or norm_fact == "no new memories.":
        return

    if await _already_have(db, chat_id, norm_fact):
        return  

    try:
        emb = await get_embedding(norm_fact)
    except Exception as exc:
        log.error("get_embedding failed for fact=%r chat=%s err=%s", norm_fact, chat_id, exc, exc_info=True)
        return

    await upsert_memory(
        db=db,
        chat_id=chat_id,
        content=norm_fact,
        embedding=emb,
        sender=sender
    )


async def store_facts_batch(
    db,
    chat_id: str,
    facts: list[str],
    sender: str = "system",
) -> int:
    """
    Store multiple facts using batch embedding and batched dedup.

    Optimisations vs the original sequential approach:
    1. Single-query dedup  (1 DB call instead of N)
    2. Batch embedding      (already existed)
    """

    if not facts:
        return 0

    # 1. Normalize and deduplicate locally
    normalized: list[str] = []
    seen: set[str] = set()
    for fact in facts:
        norm = _norm(fact)
        if norm and norm != "no new memories." and norm not in seen:
            normalized.append(norm)
            seen.add(norm)

    if not normalized:
        return 0

    # 2. Batch dedup against DB — single round-trip
    existing = await _batch_already_have(db, chat_id, normalized)
    new_facts = [n for n in normalized if n not in existing]

    if not new_facts:
        log.debug("All %d facts already exist for chat=%s", len(normalized), chat_id)
        return 0

    # 3. Batch embed all new facts in ONE API call
    try:
        embeddings = await get_embeddings_batch(new_facts)
    except Exception as exc:
        log.error("Batch embedding failed for chat=%s: %s", chat_id, exc, exc_info=True)
        return 0

    # 4. Store all facts (sequential — upsert_memory commits per call,
    #    and AsyncSession is NOT safe for concurrent transactions)
    stored = 0
    for fact, emb in zip(new_facts, embeddings):
        if not emb:
            continue
        try:
            # Dynamically route memory by checking who the fact is about
            fact_sender = sender
            if sender == "system":
                lower_fact = fact.lower().strip()
                if lower_fact.startswith("user") or lower_fact.startswith("the user"):
                    fact_sender = "user"

            action = await upsert_memory(
                db=db,
                chat_id=chat_id,
                content=fact,
                embedding=emb,
                sender=fact_sender,
            )
            stored += 1
            log.info(
                "[MEMORY] %s fact for chat=%s sender=%s: %s",
                (action or "unknown").upper(), chat_id, fact_sender, fact[:80],
            )
        except Exception as exc:
            log.error("Failed to store fact=%r chat=%s: %s", fact, chat_id, exc)

    log.info("Stored %d/%d facts for chat=%s", stored, len(new_facts), chat_id)
    return stored
