from app.services.embeddings import get_embedding, get_embeddings_batch, search_similar_memories, search_similar_messages, search_similar_memories_and_messages, upsert_memory
from sqlalchemy import select, union_all
from sqlalchemy.sql import func
from app.db.models import Memory, Chat, Message
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
import logging
from app.db.session import SessionLocal

log = logging.getLogger(__name__)

async def extract_memories_from_transcript(
    chat_id: str,
    transcript_entries: list,
    conversation_id: str,
) -> None:
    from app.agents.prompts import FACT_EXTRACTOR, get_fact_prompt
    import asyncio

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

    log.info(
        "[MEMORY-BG] chunking transcript of %d turns conv=%s chat=%s",
        len(all_turns), conversation_id, chat_id,
    )

    chunks = []
    # Step through conversation in exchange pairs (e.g. every 2 turns)
    for i in range(0, len(all_turns), 2):
        chunk_turns = all_turns[:i+2]
        if not chunk_turns:
            continue
        
        ctx_turns = chunk_turns[-6:-2]  # Up to 4 turns of context
        msg_turns = chunk_turns[-2:]    # The latest 1-2 turns to evaluate

        ctx_str = "\n".join(f"{t['sender']}: {t['text']}" for t in ctx_turns)
        msg_str = "\n".join(f"{t['sender']}: {t['text']}" for t in msg_turns)
        chunks.append((ctx_str, msg_str))

    async with SessionLocal() as db:
        try:
            fact_prompt = await get_fact_prompt(db)
            
            async def extract_chunk(ctx_str: str, msg_str: str):
                try:
                    resp = await FACT_EXTRACTOR.ainvoke(
                        fact_prompt.format(msg=msg_str, ctx=ctx_str)
                    )
                    txt = (resp.content or "").strip("- ").strip()
                    if txt and txt.lower() != "no new memories.":
                        return txt
                except Exception as e:
                    log.warning("Chunk extraction failed: %s", e)
                return None

            # Concurrently extract from all chunks (limit concurrency if needed, but 10-20 chunks is fine for asyncio.gather)
            tasks = [extract_chunk(ctx, msg) for ctx, msg in chunks]
            extracted_results = await asyncio.gather(*tasks)

            # Filter valid facts
            valid_facts = [f for f in extracted_results if f]

            if valid_facts:
                stored = await store_facts_batch(db, chat_id, valid_facts)
                log.info(
                    "[MEMORY-BG] stored %d/%d facts from chunks conv=%s chat=%s",
                    stored, len(valid_facts), conversation_id, chat_id,
                )
            else:
                log.info("[MEMORY-BG] no new facts extracted from chunks conv=%s", conversation_id)

        except Exception as exc:
            log.error(
                "[MEMORY-BG] fact extraction failed conv=%s chat=%s err=%s",
                conversation_id, chat_id, exc, exc_info=True,
            )




async def summarize_memory_list(
    memories: list[str],
    model: str = "gpt-4o-mini",
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
                "You summarize relationship/chat memory logs. "
                "Be concise, factual, and avoid hallucinations.",
            ),
            (
                "human",
                "Summarize these memories into:\n"
                "1) Key Facts\n"
                "2) Preferences/Likes\n"
                "3) Dislikes/Boundaries\n"
                "4) Open Threads / Follow-ups\n"
                "5) One-paragraph Overall Summary\n\n"
                "Only use information present in the memories.\n\n"
                "Memories:\n{memory_block}",
            ),
        ]
    )
    llm = ChatOpenAI(
        model=model,
        temperature=0.2,
        max_tokens=700,
        store=False,
    )
    chain = prompt | llm
    resp = await chain.ainvoke({"memory_block": memory_block})
    return (resp.content or "").strip() or "(empty summary)"


async def get_summarized_memories(
    db,
    user_id: int,
    influencer_id: str,
    model: str = "gpt-4o-mini",
    max_items: int = 400,
) -> str:
    """
    Fetch all memories for a user-influencer pair and return an LLM summary.
    """
    memories = await get_all_memory_list(db, user_id, influencer_id)
    return await summarize_memory_list(memories, model=model, max_items=max_items)


async def get_all_memory_list(
    db,
    user_id: int,
    influencer_id: str,
) -> list[str]:
    """
    Return all memory-related text for a user-influencer pair as a plain list[str].

    Combines:
    - Extracted long-term memories from `memories`
    - Chat messages from `messages`

    Ordered newest-first across both sources.
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
        select(combined.c.content)
        .order_by(combined.c.created_at.desc(), combined.c.row_id.desc())
    )

    rows = await db.execute(timeline_q)
    result = [
        content.strip()
        for (content,) in rows.fetchall()
        if isinstance(content, str) and content.strip()
    ]

    log.debug(
        "get_all_memory_list user=%s influencer=%s chats=%d items=%d",
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
    Store multiple facts using batch embedding (70-80% faster than sequential).
    
    Args:
        db: Database session
        chat_id: Chat ID to associate facts with
        facts: List of fact strings to store
        sender: Sender identifier
        
    Returns:
        Number of facts successfully stored
    """
    if not facts:
        return 0
    
    # 1. Normalize and deduplicate
    normalized = []
    for fact in facts:
        norm = _norm(fact)
        if norm and norm != "no new memories." and norm not in normalized:
            normalized.append(norm)
    
    if not normalized:
        return 0
    
    # 2. Filter out already-existing facts
    new_facts = []
    for norm in normalized:
        if not await _already_have(db, chat_id, norm):
            new_facts.append(norm)
    
    if not new_facts:
        log.debug("All %d facts already exist for chat=%s", len(normalized), chat_id)
        return 0
    
    # 3. Batch embed all new facts in ONE API call
    try:
        embeddings = await get_embeddings_batch(new_facts)
    except Exception as exc:
        log.error("Batch embedding failed for chat=%s: %s", chat_id, exc, exc_info=True)
        return 0
    
    # 4. Store all facts
    stored = 0
    for fact, emb in zip(new_facts, embeddings):
        if not emb:  # Skip failed embeddings
            continue
        try:
            await upsert_memory(
                db=db,
                chat_id=chat_id,
                content=fact,
                embedding=emb,
                sender=sender
            )
            stored += 1
        except Exception as exc:
            log.error("Failed to store fact=%r chat=%s: %s", fact, chat_id, exc)
    
    log.info("Stored %d/%d facts for chat=%s", stored, len(new_facts), chat_id)
    return stored
