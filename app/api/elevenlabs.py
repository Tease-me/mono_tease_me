import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory import (
    get_memory_only_list,
    summarize_ai_memory_list,
    summarize_memory_list,
)
from app.agents.prompt_utils import (
    build_relationship_prompt,
    get_global_prompt,
    get_mbti_rules_for_archetype,
    get_relationship_stage_prompts,
    get_time_context,
)
from app.agents.turn_handler import (
    _build_user_name_block,
    _messages_since_session_break,
    inject_session_break,
    redis_history,
)
from app.core.config import settings
from app.data.models import CallRecord, Chat, Influencer, Memory, User
from app.core.session import SessionLocal, get_db
from app.gateways.elevenlabs.conversation_gateway import ElevenLabsConversationGateway
from app.services.relationship.dtr import plan_dtr_goal
from app.services.relationship.inactivity import apply_inactivity_decay
from app.services.relationship.repo import get_or_create_relationship
from app.data.schemas.elevenlabs import RegisterConversationBody
from app.services.billing import (
    can_afford,
    get_remaining_units,
    resolve_voice_billing_mode,
)
from app.services.chat_service import get_or_create_chat
from app.services.follow import get_follow
from app.services.prompting.influencer_bio import extract_influencer_bio_context
from app.use_cases.elevenlabs_call_lifecycle import save_pending_conversation
from app.use_cases.elevenlabs_call_persistence import poll_and_persist_conversation
from app.use_cases.elevenlabs_credit_guard import end_conversation_after_credits
from app.use_cases.elevenlabs_greeting import build_call_greeting
from app.utils.auth.dependencies import get_current_user
from app.utils.elevenlabs_conversation import (
    extract_total_seconds,
    normalize_transcript,
)
from app.utils.logging.prompt_logging import log_prompt

router = APIRouter(prefix="/elevenlabs", tags=["elevenlabs"])
log = logging.getLogger(__name__)

ELEVENLABS_API_KEY = settings.ELEVENLABS_API_KEY
ELEVEN_BASE_URL = settings.ELEVEN_BASE_URL
DEFAULT_ELEVENLABS_VOICE_ID = settings.ELEVENLABS_VOICE_ID or None
_conversation_gateway = ElevenLabsConversationGateway()


async def get_agent_id_from_influencer(db: AsyncSession, influencer_id: str) -> str:
    influencer = await db.get(Influencer, influencer_id)
    if influencer and getattr(influencer, "influencer_agent_id_third_part", None):
        return influencer.influencer_agent_id_third_part
    raise HTTPException(404, "Influencer or influencer_agent_id_third_part not found")


@router.get("/signed-url")
async def get_signed_url(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    first_message: Optional[str] = Query(None),
    greeting_mode: str = Query("random", pattern="^(random|rr)$"),
    user_timezone: str = Query("UTC"),
):
    user_id = current_user.id
    if not await get_follow(db, influencer_id, user_id):
        raise HTTPException(
            status_code=403, detail="You must follow the influencer to interact."
        )

    feature, is_18 = await resolve_voice_billing_mode(db, user_id, influencer_id)

    ok, cost_cents, free_left = await can_afford(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        feature=feature,
        units=10,
        is_18=is_18,
    )

    if not ok:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "needed_cents": cost_cents,
                "free_left": free_left,
            },
        )

    credits_remainder_secs = await get_remaining_units(
        db, user_id, influencer_id, feature=feature, is_18=is_18
    )

    agent_id = await get_agent_id_from_influencer(db, influencer_id)
    chat_id = await get_or_create_chat(db, user_id, influencer_id)

    # Mark new call session boundary in Redis history
    inject_session_break(chat_id)

    greeting: Optional[str] = first_message
    if not greeting:
        greeting = await build_call_greeting(
            db=db,
            chat_id=chat_id,
            influencer_id=influencer_id,
            user_timezone=user_timezone,
            greeting_mode=greeting_mode,
        )

    signed_url = await _conversation_gateway.get_conversation_signed_url(agent_id)

    return {
        "signed_url": signed_url,
        "greeting_used": greeting,
        "first_message_for_convai": greeting,
        "dynamic_variables": {"first_message": greeting} if greeting else {},
        "agent_id": agent_id,
        "credits_remainder_secs": credits_remainder_secs,
        "chat_id": chat_id,
    }


@router.get("/conversation-token")
async def get_conversation_token(
    influencer_id: str,
    user_timezone: str = Query("UTC"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id
    if not await get_follow(db, influencer_id, user_id):
        raise HTTPException(
            status_code=403, detail="You must follow the influencer to interact."
        )

    feature, is_18 = await resolve_voice_billing_mode(db, user_id, influencer_id)

    ok, cost_cents, free_left = await can_afford(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        feature=feature,
        units=10,
        is_18=is_18,
    )

    if not ok:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "needed_cents": cost_cents,
                "free_left": free_left,
            },
        )

    # ── OPT: Single influencer fetch (was duplicated via get_agent_id_from_influencer) ──
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(404, "Influencer not found")
    agent_id = influencer.influencer_agent_id_third_part
    if not agent_id:
        raise HTTPException(404, "Influencer agent_id not found")

    bio_ctx = extract_influencer_bio_context(influencer)
    persona_likes = bio_ctx.likes
    persona_dislikes = bio_ctx.dislikes
    influencer_stages = bio_ctx.stages
    personality_rules = bio_ctx.personality_rules
    tone = bio_ctx.tone
    mbti_archetype = bio_ctx.mbti_archetype
    mbti_addon = bio_ctx.mbti_rules_addon
    daily_context = ""

    # ── OPT: Parallel Wave 1 — independent DB lookups via dedicated sessions ──
    async def _w1_prompt_template():
        async with SessionLocal() as s:
            return await get_global_prompt(s, True)

    async def _w1_chat_id():
        async with SessionLocal() as s:
            return await get_or_create_chat(s, user_id, influencer_id)

    async def _w1_relationship():
        async with SessionLocal() as s:
            return await get_or_create_relationship(s, int(user_id), influencer_id)

    async def _w1_stages():
        async with SessionLocal() as s:
            return await get_relationship_stage_prompts(s)

    async def _w1_mbti():
        async with SessionLocal() as s:
            return await get_mbti_rules_for_archetype(s, mbti_archetype, mbti_addon)

    async def _w1_time_ctx():
        async with SessionLocal() as s:
            return await get_time_context(s, user_timezone)

    (
        prompt_template,
        chat_id,
        rel,
        stages,
        mbti_rules,
        time_context,
    ) = await asyncio.gather(
        _w1_prompt_template(),
        _w1_chat_id(),
        _w1_relationship(),
        _w1_stages(),
        _w1_mbti(),
        _w1_time_ctx(),
    )

    now = datetime.now(timezone.utc)
    days_idle = apply_inactivity_decay(rel, now)

    can_ask = (
        rel.state == "DATING"
        and rel.safety >= 70
        and rel.trust >= 75
        and rel.closeness >= 70
        and rel.attraction >= 65
    )

    dtr_goal = plan_dtr_goal(rel, can_ask)

    history = redis_history(chat_id)

    # Mark new call session boundary in Redis history
    inject_session_break(chat_id)

    if len(history.messages) > settings.MAX_HISTORY_WINDOW:
        trimmed = history.messages[-settings.MAX_HISTORY_WINDOW :]
        history.clear()
        history.add_messages(trimmed)

    # Scope recent_ctx to current session only (excludes previous call messages)
    current_session_msgs = _messages_since_session_break(history.messages)

    if current_session_msgs:
        recent_ctx = "\n".join(
            f"{m.type}: {m.content}"
            for m in current_session_msgs[-20:]
            if getattr(m, "type", None) != "system"
            and "[SESSION BREAK]" not in getattr(m, "content", "")
            and getattr(m, "content", "").strip() != "..."
        )
    else:
        # Fallback to the last 20 historical messages if this is a fresh session
        recent_ctx = "\n".join(
            f"{m.type}: {m.content}"
            for m in history.messages[-20:]
            if getattr(m, "type", None) != "system"
            and "[SESSION BREAK]" not in getattr(m, "content", "")
            and getattr(m, "content", "").strip() != "..."
        )

    # ── OPT: Parallel Wave 2 — memory + user data via dedicated sessions ──
    async def _w2_users_name():
        async with SessionLocal() as s:
            return await _build_user_name_block(s, user_id)

    async def _w2_memories():
        async with SessionLocal() as s:
            return await get_memory_only_list(
                s, user_id, influencer_id, exclude_sender="system"
            )

    async def _w2_ai_memories():
        async with SessionLocal() as s:
            ai_mem_query = (
                select(Memory.content)
                .where(
                    Memory.chat_id.in_(
                        select(Chat.id).where(
                            Chat.user_id == user_id, Chat.influencer_id == influencer_id
                        )
                    ),
                    Memory.sender == "system",
                )
                .order_by(Memory.created_at.desc())
                .limit(200)
            )
            ai_mem_res = await s.execute(ai_mem_query)
            return [row[0] for row in ai_mem_res.fetchall()]

    async def _w2_credits():
        async with SessionLocal() as s:
            return await get_remaining_units(
                s, user_id, influencer_id, feature=feature, is_18=is_18
            )

    users_name, memories, ai_mem_list, credits_remainder_secs = await asyncio.gather(
        _w2_users_name(),
        _w2_memories(),
        _w2_ai_memories(),
        _w2_credits(),
    )

    # ── OPT: Async Redis pool (was creating sync connection per-request) ──
    from app.utils.infrastructure.redis_pool import get_redis

    _rclient = await get_redis()
    mem_summary_ttl = 86400  # 24h safety — invalidated on write by store_facts_batch
    greeting_ttl = 5  # seconds — skip LLM on rapid reconnects
    _mem_cache_key = f"mem_summary:{chat_id}"
    _ai_mem_cache_key = f"ai_mem_summary:{chat_id}"
    _greeting_cache_key = f"greeting:{chat_id}"
    cached_mem = await _rclient.get(_mem_cache_key)
    cached_ai_mem = await _rclient.get(_ai_mem_cache_key)
    cached_greeting = await _rclient.get(_greeting_cache_key)

    async def _fetch_token() -> str:
        return await _conversation_gateway.get_conversation_token(agent_id)

    # ── OPT: Greeting now cached (45s TTL) to skip LLM on reconnects ──
    async def _resolve_greeting():
        if cached_greeting:
            log.info("get_conversation_token.greeting_cache_hit chat=%s", chat_id)
            return cached_greeting
        g = await build_call_greeting(
            db=db,
            chat_id=chat_id,
            influencer_id=influencer_id,
            user_timezone=user_timezone,
            greeting_mode="random",
            persona_name=influencer.display_name if influencer else influencer_id,
            rel=rel,
            stages=stages,
            influencer_stages=influencer_stages,
        )
        if g:
            try:
                await _rclient.setex(_greeting_cache_key, greeting_ttl, g)
            except Exception as exc:
                log.warning(
                    "get_conversation_token.greeting_cache_set_failed chat=%s err=%s",
                    chat_id,
                    exc,
                )
        return g

    if cached_mem and cached_ai_mem:
        # Cache hit — skip LLM summarization entirely
        memory = cached_mem
        ai_mem_block = cached_ai_mem
        greeting, token = await asyncio.gather(
            _resolve_greeting(),
            _fetch_token(),
        )
        log.info("get_conversation_token.cache_hit chat=%s", chat_id)
    else:
        # Cache miss — run LLM summarization and cache results
        memory, ai_mem_block, greeting, token = await asyncio.gather(
            summarize_memory_list(memories or []),
            summarize_ai_memory_list(ai_mem_list),
            _resolve_greeting(),
            _fetch_token(),
        )
        try:
            await _rclient.setex(_mem_cache_key, mem_summary_ttl, memory)
            await _rclient.setex(_ai_mem_cache_key, mem_summary_ttl, ai_mem_block)
            log.info(
                "get_conversation_token.cache_set chat=%s ttl=%d",
                chat_id,
                mem_summary_ttl,
            )
        except Exception as exc:
            log.warning(
                "get_conversation_token.cache_set_failed chat=%s err=%s", chat_id, exc
            )

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
        memories=memory,
        ai_memories=ai_mem_block,
        daily_context=daily_context,
        last_user_message=recent_ctx,
        mood=time_context,
        tone=tone,
        influencer_name=influencer.display_name,
        users_name=users_name,
        influencer_stages=influencer_stages,
    )

    log_prompt(log, prompt, cid="", input="")

    return {
        "token": token,
        "agent_id": agent_id,
        "credits_remainder_secs": credits_remainder_secs,
        "greeting_used": greeting,
        "prompt": prompt.format(input=""),
        "voice_id": influencer.voice_id or DEFAULT_ELEVENLABS_VOICE_ID,
        "native_language": influencer.native_language if influencer else "en",
    }


@router.get("/signed-url-free")
async def get_signed_url_free(
    influencer_id: str,
    db: AsyncSession = Depends(get_db),
):
    agent_id = await get_agent_id_from_influencer(db, influencer_id)
    greeting = None

    signed_url = await _conversation_gateway.get_conversation_signed_url(agent_id)

    return {
        "signed_url": signed_url,
        "greeting_used": greeting,
        "first_message_for_convai": greeting,
        "dynamic_variables": {"first_message": greeting} if greeting else {},
        "agent_id": agent_id,
    }


@router.get("/signed-url-free-landing")
async def get_signed_url_free_landing(db: AsyncSession = Depends(get_db)):
    agent_id = settings.LANDING_PAGE_AGENT_ID

    signed_url = await _conversation_gateway.get_conversation_signed_url(agent_id)

    return {
        "signed_url": signed_url,
        "agent_id": agent_id,
    }


@router.post("/conversations/{conversation_id}/register")
async def register_conversation(
    conversation_id: str,
    body: RegisterConversationBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not await get_follow(db, body.influencer_id, body.user_id):
        raise HTTPException(
            status_code=403, detail="You must follow the influencer to interact."
        )

    chat_id = await save_pending_conversation(
        db,
        conversation_id,
        current_user.id,
        body.influencer_id,
        body.sid,
        body.is_adult_call,
        body.adult_character_id,
    )
    if not chat_id:
        try:
            res = await db.execute(
                select(CallRecord.chat_id).where(
                    CallRecord.conversation_id == conversation_id
                )
            )
            row = res.first()
            chat_id = row[0] if row else None
        except Exception:
            pass

    # Mark new call session boundary in Redis history (fallback path)
    if chat_id:
        inject_session_break(chat_id)

    try:
        asyncio.create_task(
            poll_and_persist_conversation(
                conversation_id,
                user_id=body.user_id,
                influencer_id=body.influencer_id,
                chat_id=chat_id,
            )
        )
    except Exception as exc:
        log.warning(
            "register.background_poll_failed conv=%s err=%s", conversation_id, exc
        )

    # Schedule credit-based call termination
    if body.influencer_id:
        try:
            asyncio.create_task(
                end_conversation_after_credits(
                    conversation_id,
                    user_id=body.user_id,
                    influencer_id=body.influencer_id,
                )
            )
        except Exception as exc:
            log.warning(
                "register.credit_guard_failed conv=%s err=%s", conversation_id, exc
            )

    return {"ok": True, "conversation_id": conversation_id}


@router.get("/calls/{conversation_id}")
async def get_call_details(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    call = await db.get(CallRecord, conversation_id)
    if not call:
        raise HTTPException(404, "Call not found")
    if call.user_id != current_user.id:
        raise HTTPException(403, "Forbidden")

    transcript = call.transcript or []
    duration = call.call_duration_secs
    status = call.status
    agent_id = None

    if not transcript or duration is None:
        snapshot = await _conversation_gateway.get_conversation_snapshot(
            conversation_id
        )
        agent_id = snapshot.get("agent_id")
        if not transcript:
            transcript = normalize_transcript(snapshot)
        if duration is None:
            duration = extract_total_seconds(snapshot)
        status = snapshot.get("status", status)

    return {
        "conversation_id": conversation_id,
        "user_id": call.user_id,
        "influencer_id": call.influencer_id,
        "chat_id": call.chat_id,
        "status": status,
        "duration_seconds": duration,
        "transcript": transcript,
        "created_at": call.created_at.isoformat() if call.created_at else None,
        "agent_id": agent_id,
    }
