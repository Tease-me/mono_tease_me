import logging
import asyncio
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException

from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import RedisChatMessageHistory

from app.core.config import settings
from app.agents.memory import find_similar_memories, store_facts_batch
from app.agents.prompts import MODEL, FACT_EXTRACTOR, CONVO_ANALYZER, get_fact_prompt
from app.core.session import SessionLocal
from app.services.knowledge_rag import retrieve_knowledge_chunks
from app.agents.prompt_utils import (
    get_global_prompt,
    build_relationship_prompt,
    get_time_context,
    get_mbti_rules_for_archetype,
    get_relationship_stage_prompts,
)
from app.data.models import Influencer, User
from app.services.prompting.influencer_bio import extract_influencer_bio_context
from app.utils.messaging.tts_sanitizer import sanitize_tts_text
from app.utils.logging.prompt_logging import log_prompt
from app.agents.callbacks import UsageTrackingCallback

from app.services.relationship.processor import process_relationship_turn

log = logging.getLogger(__name__)

SESSION_BREAK_TAG = "[SESSION BREAK]"


def redis_history(chat_id: str):
    return RedisChatMessageHistory(
        session_id=chat_id,
        url=settings.REDIS_URL,
        ttl=settings.HISTORY_TTL,
    )


def inject_session_break(chat_id: str) -> None:
    """Inject a session boundary marker into Redis history for a new call.

    Prevents the LLM from treating previous call history as the current
    conversation. Idempotent — skips if the last message is already a marker.
    """
    history = redis_history(chat_id)
    msgs = history.messages
    if msgs:
        last_content = getattr(msgs[-1], "content", "")
        if SESSION_BREAK_TAG in last_content:
            return  # already marked
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    history.add_ai_message(
        f"{SESSION_BREAK_TAG} — Prior conversation ended. "
        f"New call starting at {now_str}. "
        f"Treat the following as a new interaction. "
        f"You can reference memories from past conversations, "
        f"but do NOT continue where you left off.]"
    )


def _messages_since_session_break(messages: list) -> list:
    """Return only messages after the last SESSION BREAK marker."""
    for i in range(len(messages) - 1, -1, -1):
        content = getattr(messages[i], "content", "")
        if SESSION_BREAK_TAG in content:
            return messages[i + 1:]
    return messages  # no marker found, return all


class SessionScopedChatMessageHistory:
    """Wrapper that limits history visibility to the current session."""

    def __init__(self, redis_history):
        self._redis = redis_history

    @property
    def messages(self):
        return _messages_since_session_break(self._redis.messages)

    def add_message(self, message):
        self._redis.add_message(message)
    
    def add_messages(self, messages):
        self._redis.add_messages(messages)
    
    def clear(self):
        self._redis.clear()


def _norm(m):
    if m is None:
        return ""
    if isinstance(m, str):
        return m.strip()
    if isinstance(m, (list, tuple)):
        parts = []
        for x in m:
            if isinstance(x, str):
                parts.append(x.strip())
            else:
                parts.append(str(x).strip())
        return " ".join(part for part in parts if part)
    if isinstance(m, dict):
        for key in ("content", "text", "message", "snippet", "summary"):
            if key in m and isinstance(m[key], str):
                return m[key].strip()
        return str(m).strip()
    return str(m).strip()


async def _build_user_name_block(db, user_id) -> str:
    
    user = None
    if user_id:
        try:
            user = await db.get(User, int(user_id))
        except Exception as exc:
            log.warning("_build_user_name_block: failed to fetch user %s: %s", user_id, exc)

    if user:
        parts = []
        full_name = (user.full_name or "").strip()
        username = (user.username or "").strip()
        gender = (user.gender or "").strip()
        dob = user.date_of_birth

        if full_name:
            parts.append(f"Full name: {full_name}")
        if username:
            parts.append(f"Username: {username}")
        if gender:
            parts.append(f"Gender: {gender}")
        if dob:
            parts.append(f"Date of birth: {dob.strftime('%B %d, %Y')}")

        if parts:
            return (
                ", ".join(parts) + ". "
                "Use their name naturally and sparingly — don't overuse it. "
                "If the user has told you to call them something else "
                "(check your memories), use that preferred name instead."
            )
    return (
        "You don't know the user's name yet. "
        "If you've learned it in past conversations, use it from memory. "
        "Otherwise, don't assume a name."
    )


async def extract_and_store_facts_for_turn(
    message: str,
    reply: str,
    recent_ctx: str,
    chat_id: str,
    cid: str,
) -> None:
    log.info("[%s] fact_extract.start chat=%s", cid, chat_id)
    from datetime import datetime, timezone as _tz
    async with SessionLocal() as db:
        try:
            fact_prompt = await get_fact_prompt(db)
            
            exchange = f"user: {message}\nai: {reply}"
            ts_now = datetime.now(_tz.utc).strftime("%Y-%m-%d %H:%M UTC")

            tracker = UsageTrackingCallback(
                category="extraction",
                purpose="fact_extraction",
                chat_id=chat_id,
            )
            facts_resp = await FACT_EXTRACTOR.ainvoke(
                fact_prompt.format(msg=exchange, ctx=recent_ctx, ts=ts_now),
                config={"callbacks": [tracker]}
            )

            facts_txt = facts_resp.content or ""
            log.debug(
                "[%s] fact_extract.llm_response chat=%s raw=%s",
                cid, chat_id, facts_txt[:200],
            )
            lines = [ln.strip("- ").strip() for ln in facts_txt.split("\n") if ln.strip()]
            
            # Filter out empty/skip lines
            valid_facts = [line for line in lines[:5] if line.lower() != "no new memories."]
            
            if valid_facts:
                # Use batch storage - single API call for all facts
                stored = await store_facts_batch(db, chat_id, valid_facts)
                log.info(
                    "[%s] fact_extract.stored chat=%s stored=%d",
                    cid, chat_id, stored,
                )
            else:
                log.info("[%s] fact_extract.no_facts chat=%s", cid, chat_id)
                
        except Exception as ex:
            log.error("[%s] Fact extraction failed: %s", cid, ex, exc_info=True)



async def handle_turn(
    message: str,
    chat_id: str,
    influencer_id: str,
    user_id: str | None = None,
    db=None,
    is_audio: bool = False,
    user_timezone: str | None = None,
) -> str:
    cid = uuid4().hex[:8]
    log.info("[%s] START persona=%s chat=%s user=%s", cid, influencer_id, chat_id, user_id)

    history = redis_history(chat_id)

    if len(history.messages) > settings.MAX_HISTORY_WINDOW:
        trimmed = history.messages[-settings.MAX_HISTORY_WINDOW:]
        history.clear()
        history.add_messages(trimmed)

    # For audio/call mode, scope context to the current call session only
    if is_audio:
        # Wrap history so RunnableWithMessageHistory also respects the session boundary
        history_for_runnable = SessionScopedChatMessageHistory(history)
        ctx_messages = history_for_runnable.messages
    else:
        history_for_runnable = history
        ctx_messages = history.messages

    recent_ctx = "\n".join(f"{m.type}: {m.content}" for m in ctx_messages[-6:])

    # Phase 1: Fetch cached prompts in parallel (Redis cache, no DB contention)
    prompt_template = await get_global_prompt(db, is_audio)
    
    influencer = await db.get(Influencer, influencer_id)
    
    # Generate simple time context instead of picking from mood arrays
    time_context = await get_time_context(db, user_timezone)

    if not influencer:
        raise HTTPException(404, "Influencer not found")

    if not user_id:
        raise HTTPException(400, "user_id is required for relationship persistence")

    from app.services.embeddings import get_embedding
    message_embedding = await get_embedding(message) if (db and user_id) else None

    async def _relationship_with_own_session(**kwargs):
        async with SessionLocal() as rel_db:
            return await process_relationship_turn(db=rel_db, **kwargs)

    async def _safe_memories():
        if not (db and user_id):
            return {"user_memories": [], "ai_memories": []}
        try:
            return await find_similar_memories(
                db,
                chat_id,
                message,
                embedding=message_embedding,
                user_timezone=user_timezone,
            )
        except Exception as exc:
            log.warning("[%s] memory retrieval failed: %s", cid, exc)
            return {"user_memories": [], "ai_memories": []}

    async def _safe_knowledge():
        if not (db and influencer_id and message_embedding):
            return []
        try:
            return await retrieve_knowledge_chunks(
                db=db,
                influencer_id=influencer_id,
                query_embedding=message_embedding,
                top_k=5,
            )
        except Exception as exc:
            log.warning("[%s] knowledge retrieval failed influencer=%s: %s", cid, influencer_id, exc)
            return []

    # Fetch memories + knowledge in parallel first
    memories_result, knowledge_result = await asyncio.gather(
        _safe_memories(),
        _safe_knowledge(),
    )

    # Build mem_block early so we can pass it to relationship signal classification
    memories = memories_result[0] if isinstance(memories_result, tuple) else memories_result
    
    # Split memories by sender type
    if isinstance(memories, dict):
        user_mems = memories.get("user_memories", "")
        ai_mems = memories.get("ai_memories", "")
    else:
        user_mems = memories or []
        ai_mems = []

    # Memories are now pre-formatted strings with day labels (Today > Yesterday > Older)
    # If string, use directly; if list (backward compat), join them
    if isinstance(user_mems, str):
        mem_block = user_mems
    else:
        mem_block = "\n".join(s for s in (_norm(m) for m in user_mems) if s)

    if isinstance(ai_mems, str):
        ai_mem_block = ai_mems
    else:
        ai_mem_block = "\n".join(s for s in (_norm(m) for m in ai_mems) if s)

    # Pass memories to relationship signal classifier for better context
    rel_pack = await _relationship_with_own_session(
        user_id=int(user_id),
        influencer_id=influencer_id,
        message=message,
        recent_ctx=recent_ctx,
        cid=cid,
        convo_analyzer=CONVO_ANALYZER,
        influencer=influencer,
        memories=mem_block,
        ai_memories=ai_mem_block,
    )
   
    rel = rel_pack["rel"]
    days_idle = rel_pack["days_idle"]
    dtr_goal = rel_pack["dtr_goal"]

    knowledge_block = "\n".join(s for s in (_norm(m) for m in knowledge_result or []) if s)

    log.debug(
        "[%s] rag_context influencer=%s kb_hits=%d mem_chars=%d ai_mem_chars=%d kb_chars=%d",
        cid,
        influencer_id,
        len(knowledge_result or []),
        len(mem_block),
        len(ai_mem_block),
        len(knowledge_block),
    )

    bio_ctx = extract_influencer_bio_context(influencer)
    persona_likes = bio_ctx.likes
    persona_dislikes = bio_ctx.dislikes
    
    mbti_archetype = bio_ctx.mbti_archetype
    mbti_addon = bio_ctx.mbti_rules_addon
    
    stages, mbti_rules = await asyncio.gather(
        get_relationship_stage_prompts(db),
        get_mbti_rules_for_archetype(db, mbti_archetype, mbti_addon)
    )
    
    for key, val in stages.items():
        stages[key] = val

    personality_rules = bio_ctx.personality_rules
    tone = bio_ctx.tone
    daily_context = ""  
    users_name = await _build_user_name_block(db, user_id)

    prompt = build_relationship_prompt(
        prompt_template,
        rel=rel,
        days_idle=days_idle,
        dtr_goal=dtr_goal,
        personality_rules=personality_rules,
        stages=stages,
        persona_likes=persona_likes,
        persona_dislikes=persona_dislikes,
        mbti_rules=mbti_rules,
        memories=mem_block,
        ai_memories=ai_mem_block,
        knowledge_context=knowledge_block,
        daily_context=daily_context,
        last_user_message=recent_ctx,
        mood=time_context,
        tone=tone,
        influencer_name=influencer.display_name,
        users_name=users_name,
        influencer_stages=bio_ctx.stages,
    )

    hist_msgs = history.messages
    log_prompt(log, prompt, cid=cid, input=message, history=hist_msgs)

    chain = prompt | MODEL

    runnable = RunnableWithMessageHistory(
        chain,
        lambda _: history_for_runnable,
        input_messages_key="input",
        history_messages_key="history",
    )

    tracker = UsageTrackingCallback(
        category="call" if is_audio else "text",
        purpose="main_reply",
        user_id=int(user_id) if user_id else None,
        influencer_id=influencer_id,
        chat_id=chat_id,
    )
    try:
        result = await runnable.ainvoke(
            {"input": message},
            config={
                "configurable": {"session_id": chat_id},
                "callbacks": [tracker]
            },
        )
        reply = result.content
    except Exception as e:
        log.error("[%s] LLM error: %s", cid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="LLM generation failed")

    # Trim Redis history after reply to prevent unbounded growth mid-session.
    # RunnableWithMessageHistory already added the user msg + AI reply above,
    # so history may now exceed MAX_HISTORY_WINDOW.
    try:
        if len(history.messages) > settings.MAX_HISTORY_WINDOW:
            trimmed = history.messages[-settings.MAX_HISTORY_WINDOW:]
            history.clear()
            history.add_messages(trimmed)
    except Exception as exc:
        log.warning("[%s] post-reply history trim failed: %s", cid, exc)

    # Schedule background fact extraction (fire-and-forget)
    # Store task reference to prevent premature garbage collection
    try:
        fact_task = asyncio.create_task(
            extract_and_store_facts_for_turn(
                message=message,
                reply=reply,
                recent_ctx=recent_ctx,
                chat_id=chat_id,
                cid=cid,
            )
        )
        # Add done callback to log any exceptions
        fact_task.add_done_callback(
            lambda t: log.error("[%s] Fact extraction failed: %s", cid, t.exception()) 
            if t.exception() else None
        )
    except Exception as ex:
        log.error("[%s] Failed to schedule fact extraction: %s", cid, ex, exc_info=True)

    # Fire-and-forget funnel tracking for first chat event
    try:
        from app.services.funnel_tracking_service import track_first_chat
        asyncio.create_task(track_first_chat(int(user_id), influencer_id))
    except Exception as ex:
        log.warning("[%s] Failed to schedule first_chat tracking: %s", cid, ex)

    if is_audio:
        return sanitize_tts_text(reply)

    return reply
