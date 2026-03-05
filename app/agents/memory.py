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
_CHUNK_SIZE = 6           # turns per LLM chunk (≈3 exchanges → each gets its own extraction)
_CHUNK_OVERLAP_TURNS = 2  # context overlap between chunks


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
                    log.info(
                        "[MEMORY-BG] LLM raw response for conv=%s: %r",
                        conversation_id, txt[:200],
                    )
                    log.info(
                        "[MEMORY-BG] transcript input (msg) for conv=%s: %r",
                        conversation_id, msg_str[:300],
                    )
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
                # OPT: Pipeline storage + summarization in parallel
                stored, _ = await asyncio.gather(
                    store_facts_batch(db, chat_id, valid_facts, skip_cache_refresh=True),
                    _refresh_memory_summary_cache(chat_id, new_facts=valid_facts),
                )
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
    sender: str = "user",
    skip_cache_refresh: bool = False,
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
            
        actual_sender = sender
        if actual_sender == "user" and fact.lower().startswith("ai "):
            actual_sender = "system"
            
        try:
            action = await upsert_memory(
                db=db,
                chat_id=chat_id,
                content=fact,
                embedding=emb,
                sender=actual_sender,
            )
            stored += 1
            log.info(
                "[MEMORY] %s fact for chat=%s sender=%s: %s",
                (action or "unknown").upper(), chat_id, actual_sender, fact[:80],
            )
        except Exception as exc:
            log.error("Failed to store fact=%r chat=%s: %s", fact, chat_id, exc)

    log.info("Stored %d/%d facts for chat=%s", stored, len(new_facts), chat_id)

    # ── OPT: Invalidate + refresh memory summary cache after new facts ──
    if stored > 0 and not skip_cache_refresh:
        import asyncio as _aio
        _aio.create_task(_refresh_memory_summary_cache(chat_id, new_facts=new_facts))

    return stored


async def _refresh_memory_summary_cache(
    chat_id: str,
    new_facts: list[str] | None = None,
) -> None:
    """Re-compute and cache memory summaries after new facts are written.

    Supports two modes:
    - **Incremental** (new_facts provided + existing cache): merge new facts
      into the existing summary with a lightweight LLM call (~0.3-0.5s).
    - **Full** (cold start / no cache): re-fetch all memories and summarize
      from scratch (~1-2s).
    """
    _SAFETY_TTL = 86400  # 24 hours
    try:
        from app.utils.infrastructure.redis_pool import get_redis
        import asyncio
        rclient = await get_redis()

        mem_key = f"mem_summary:{chat_id}"
        ai_key = f"ai_mem_summary:{chat_id}"

        # Check for existing cached summaries (for incremental merge)
        existing_mem, existing_ai = await asyncio.gather(
            rclient.get(mem_key),
            rclient.get(ai_key),
        )

        if new_facts and existing_mem and existing_ai:
            # ── Incremental merge: much lighter LLM call ──
            user_facts = [f for f in new_facts if not f.lower().startswith("ai ")]
            ai_facts = [f for f in new_facts if f.lower().startswith("ai ")]

            tasks = []
            if user_facts:
                tasks.append(_incremental_merge_summary(
                    existing_mem, user_facts, "user_memories"
                ))
            else:
                tasks.append(_just_return(existing_mem))

            if ai_facts:
                tasks.append(_incremental_merge_summary(
                    existing_ai, ai_facts, "ai_memories"
                ))
            else:
                tasks.append(_just_return(existing_ai))

            mem_summary, ai_summary = await asyncio.gather(*tasks)

            await rclient.setex(mem_key, _SAFETY_TTL, mem_summary)
            await rclient.setex(ai_key, _SAFETY_TTL, ai_summary)
            log.info(
                "[MEM-CACHE] incremental merge chat=%s new_facts=%d",
                chat_id, len(new_facts),
            )
            return

        # ── Full re-summarize (cold start fallback) ──
        # Delete stale entries first
        await rclient.delete(mem_key, ai_key)

        async with SessionLocal() as db:
            chat = await db.get(Chat, chat_id)
            if not chat:
                log.warning("[MEM-CACHE] chat not found for refresh chat=%s", chat_id)
                return
            user_id, influencer_id = chat.user_id, chat.influencer_id

            memories = await get_memory_only_list(
                db, user_id, influencer_id, exclude_sender="system"
            )

            ai_mem_query = select(Memory.content).where(
                Memory.chat_id.in_(
                    select(Chat.id).where(
                        Chat.user_id == user_id,
                        Chat.influencer_id == influencer_id,
                    )
                ),
                Memory.sender == "system",
            ).order_by(Memory.created_at.desc()).limit(200)
            ai_mem_res = await db.execute(ai_mem_query)
            ai_mem_list = [row[0] for row in ai_mem_res.fetchall()]

        mem_summary, ai_summary = await asyncio.gather(
            summarize_memory_list(memories or []),
            summarize_ai_memory_list(ai_mem_list),
        )

        await rclient.setex(mem_key, _SAFETY_TTL, mem_summary)
        await rclient.setex(ai_key, _SAFETY_TTL, ai_summary)
        log.info(
            "[MEM-CACHE] full refresh chat=%s mem_len=%d ai_len=%d",
            chat_id, len(mem_summary), len(ai_summary),
        )
    except Exception as exc:
        log.warning("[MEM-CACHE] refresh failed chat=%s err=%s", chat_id, exc)


async def _just_return(val: str) -> str:
    """Async identity — used as a no-op task in asyncio.gather."""
    return val


async def _incremental_merge_summary(
    existing_summary: str,
    new_facts: list[str],
    summary_type: str,
) -> str:
    """Merge new facts into an existing summary with a lightweight LLM call.

    Much faster than re-summarizing all memories (~0.3-0.5s vs ~1-2s).
    """
    facts_block = "\n".join(f"- {f}" for f in new_facts)

    if summary_type == "ai_memories":
        role_ctx = (
            "You maintain an AI influencer's behavioral summary. "
            "Merge the new AI decisions/actions into the existing summary. "
            "Keep the same category structure. Be concise."
        )
    else:
        role_ctx = (
            "You maintain a relationship memory summary for an AI persona. "
            "Merge the new user facts into the existing summary. "
            "Keep the same category structure. Be concise."
        )

    prompt = ChatPromptTemplate.from_messages([
        ("system", role_ctx),
        ("human",
         "Existing summary:\n{existing_summary}\n\n"
         "New facts to incorporate:\n{new_facts}\n\n"
         "Produce the updated summary. Keep it concise and maintain the same structure. "
         "Use natural relative time language (e.g., 'just now', 'recently'). "
         "NEVER output raw dates or timestamps."),
    ])
    llm = ChatXAI(
        xai_api_key=settings.XAI_API_KEY,
        model="grok-4-1-fast-non-reasoning",
        temperature=0.2,
        max_tokens=800,
    )
    tracker = UsageTrackingCallback(
        category="analysis",
        purpose=f"incremental_merge_{summary_type}",
    )
    resp = await (prompt | llm).ainvoke(
        {"existing_summary": existing_summary, "new_facts": facts_block},
        config={"callbacks": [tracker]},
    )
    result = (resp.content or "").strip()
    return result if result else existing_summary
