import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory import (
    extract_memories_from_transcript,
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
from app.db.models import CallRecord, Chat, Influencer, Memory, Message, User
from app.db.session import SessionLocal, get_db
from app.gateways.elevenlabs.agents_gateway import (
    compute_max_duration,
)
from app.gateways.elevenlabs.client import get_elevenlabs_client
from app.gateways.elevenlabs.conversation_gateway import ElevenLabsConversationGateway
from app.moderation import handle_violation, moderate_message
from app.relationship.dtr import plan_dtr_goal
from app.relationship.inactivity import apply_inactivity_decay
from app.relationship.repo import get_or_create_relationship
from app.schemas.elevenlabs import RegisterConversationBody
from app.services.adult_character_billing import charge_adult_character_voice_call
from app.services.billing import (
    can_afford,
    charge_feature,
    get_remaining_units,
    resolve_voice_billing_mode,
)
from app.services.chat_service import get_or_create_chat
from app.services.follow import get_follow
from app.services.prompting.influencer_bio import extract_influencer_bio_context
from app.use_cases.elevenlabs_greeting import build_call_greeting
from app.utils.auth.dependencies import get_current_user
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


async def _poll_and_persist_conversation(
    conversation_id: str,
    *,
    user_id: Optional[int],
    influencer_id: Optional[str],
    chat_id: Optional[str],
) -> None:
    async with SessionLocal() as db:
        try:
            client = await get_elevenlabs_client()
            snapshot = await _wait_until_terminal_status(
                client, conversation_id, max_wait_secs=180
            )
            snapshot = await _ensure_transcript_snapshot(
                client, conversation_id, snapshot
            )
        except Exception as exc:
            log.warning(
                "background.wait_failed conv=%s err=%s",
                conversation_id,
                exc,
            )
            return

        status = (snapshot.get("status") or "").lower()
        total_seconds = _extract_total_seconds(snapshot)
        normalized_transcript = _normalize_transcript(snapshot)

        if not chat_id and user_id and influencer_id:
            try:
                chat_id = await get_or_create_chat(db, user_id, influencer_id)
            except Exception as exc:
                log.warning(
                    "background.chat_id_fallback_failed conv=%s user=%s infl=%s err=%s",
                    conversation_id,
                    user_id,
                    influencer_id,
                    exc,
                )

        # ── Billing (poll-driven, no webhook needed) ─────────────
        if status == "done" and user_id and chat_id:
            try:
                if not influencer_id:
                    from app.services.billing import _get_influencer_id_from_chat

                    influencer_id = await _get_influencer_id_from_chat(db, chat_id)

                if await claim_billing_slot(db, conversation_id):
                    try:
                        call_record = await db.get(CallRecord, conversation_id)
                        meta = {
                            "conversation_id": conversation_id,
                            "status": status,
                            "source": "poll",
                        }
                        if call_record and call_record.is_adult_call:
                            from app.repositories.adult.adult_conversation_repository import (
                                get_adult_character_by_id,
                            )

                            if call_record.adult_character_id is None:
                                raise HTTPException(
                                    400,
                                    "Missing adult_character_id for adult call billing",
                                )
                            character = await get_adult_character_by_id(
                                db, call_record.adult_character_id
                            )
                            if not character:
                                raise HTTPException(
                                    404, "Adult character not found for billing"
                                )
                            cost_charged = await charge_adult_character_voice_call(
                                db,
                                user_id=user_id,
                                influencer_id=influencer_id,
                                character=character,
                                units=math.ceil(total_seconds),
                                meta=meta,
                                allow_partial=True,
                                auto_commit=False,
                            )
                        else:
                            feature, is_18 = await resolve_voice_billing_mode(
                                db, user_id, influencer_id
                            )
                            cost_charged = await charge_feature(
                                db,
                                user_id=user_id,
                                influencer_id=influencer_id,
                                feature=feature,
                                units=math.ceil(total_seconds),
                                is_18=is_18,
                                meta=meta,
                                allow_partial=True,
                                auto_commit=False,
                            )
                        await mark_billing_done(db, conversation_id)
                        await db.commit()
                        log.info(
                            "poll.billing.success conv=%s user=%s secs=%s cost=%s",
                            conversation_id,
                            user_id,
                            total_seconds,
                            cost_charged,
                        )

                        # Track ElevenLabs cost from snapshot metadata
                        from app.api.webhooks import _extract_cost_micros
                        from app.services.token_tracker import track_usage_bg

                        cost_micros = _extract_cost_micros(snapshot)
                        track_usage_bg(
                            category="voice",
                            provider="elevenlabs",
                            model="elevenlabs_convai",
                            purpose="call_conversation",
                            user_id=user_id,
                            influencer_id=influencer_id,
                            chat_id=chat_id,
                            duration_secs=float(total_seconds),
                            latency_ms=0,
                            exact_cost_micros=cost_micros,
                        )

                        # Push updated balance to client via WebSocket
                        try:
                            from sqlalchemy import and_
                            from sqlalchemy import select as sa_select

                            from app.api.notify_ws import notify_call_billed
                            from app.db.models import InfluencerWallet
                            from app.db.models import User as UserModel

                            user_obj = await db.get(UserModel, user_id)
                            wallet = await db.scalar(
                                sa_select(InfluencerWallet).where(
                                    and_(
                                        InfluencerWallet.user_id == user_id,
                                        InfluencerWallet.influencer_id == influencer_id,
                                        InfluencerWallet.is_18.is_(is_18),
                                    )
                                )
                            )
                            if user_obj and user_obj.email:
                                await notify_call_billed(
                                    user_obj.email,
                                    balance_cents=int(wallet.balance_cents)
                                    if wallet
                                    else 0,
                                    cost_cents=cost_charged,
                                    duration_secs=total_seconds,
                                    conversation_id=conversation_id,
                                )
                        except Exception as ws_exc:
                            log.warning(
                                "poll.billing.ws_notify_failed conv=%s err=%s",
                                conversation_id,
                                ws_exc,
                            )

                    except Exception as charge_exc:
                        log.exception(
                            "poll.billing.charge_failed conv=%s err=%s — resetting billing slot",
                            conversation_id,
                            charge_exc,
                        )
                        await reset_billing_slot(db, conversation_id)
                else:
                    log.info(
                        "poll.billing.skipped already_billed conv=%s", conversation_id
                    )
            except Exception as billing_exc:
                log.exception(
                    "poll.billing.error conv=%s user=%s err=%s",
                    conversation_id,
                    user_id,
                    billing_exc,
                )

        try:
            if chat_id:
                await _persist_transcript_to_chat(
                    db,
                    conversation_json=snapshot,
                    chat_id=chat_id,
                    conversation_id=conversation_id,
                    influencer_id=influencer_id,
                )
        except Exception as exc:
            log.warning(
                "background.persist_transcript_failed conv=%s chat=%s err=%s",
                conversation_id,
                chat_id,
                exc,
            )

        try:
            call_record = await db.get(CallRecord, conversation_id)
            if not call_record:
                call_record = CallRecord(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    influencer_id=influencer_id,
                    chat_id=chat_id,
                )
            call_record.status = (
                status if status != "done" else (call_record.status or status)
            )
            call_record.call_duration_secs = total_seconds
            call_record.transcript = normalized_transcript or call_record.transcript
            if influencer_id:
                call_record.influencer_id = influencer_id
            if chat_id:
                call_record.chat_id = chat_id
            db.add(call_record)
            await db.commit()
        except Exception as exc:
            log.warning(
                "background.update_call_record_failed conv=%s err=%s",
                conversation_id,
                exc,
            )


async def _ensure_transcript_snapshot(
    conversation_id: str,
    snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Some snapshots omit transcript; try a follow-up fetch to populate it.
    """
    if snapshot.get("transcript"):
        return snapshot
    try:
        refreshed = await _conversation_gateway.get_conversation_snapshot(
            conversation_id
        )
        if refreshed.get("transcript"):
            return refreshed
    except Exception as exc:
        log.warning(
            "ensure_transcript.refetch_failed conv=%s err=%s", conversation_id, exc
        )
    return snapshot


async def _wait_until_terminal_status(
    conversation_id: str,
    *,
    max_wait_secs: int = 180,
    initial_delay: float = 0.8,
    max_delay: float = 5.0,
) -> Dict[str, Any]:
    """
    Poll until status ∈ {done, failed} or timeout. Returns the last snapshot.
    """
    elapsed = 0.0
    delay = initial_delay
    last = await _conversation_gateway.get_conversation_snapshot(conversation_id)
    status = (last.get("status") or "").lower()

    while status not in {"done", "failed"} and elapsed < max_wait_secs:
        await asyncio.sleep(delay)
        elapsed += delay
        delay = min(max_delay, delay * 1.7)
        last = await _conversation_gateway.get_conversation_snapshot(conversation_id)
        status = (last.get("status") or "").lower()
    return last


def _extract_total_seconds(conversation_json: Dict[str, Any]) -> float:
    """
    Primary: metadata.call_duration_secs
    Fallback: max transcript[*].time_in_call_secs
    """
    md = conversation_json.get("metadata") or {}
    dur = md.get("call_duration_secs")
    if isinstance(dur, (int, float)) and dur >= 0:
        return float(dur)
    transcript = conversation_json.get("transcript") or []
    try:
        max_sec = (
            max(int(t.get("time_in_call_secs") or 0) for t in transcript)
            if transcript
            else 0
        )
    except Exception:
        max_sec = 0
    return float(max_sec) if max_sec else 0.0


def _normalize_transcript(conversation_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return a simple transcript list with sender/text/time_in_call_secs."""
    transcript = conversation_json.get("transcript") or []
    normalized: List[Dict[str, Any]] = []
    for entry in transcript:
        text = str(
            entry.get("text") or entry.get("content") or entry.get("message") or ""
        ).strip()
        if not text:
            continue
        role_raw = str(
            entry.get("sender") or entry.get("role") or entry.get("speaker") or ""
        ).lower()
        is_user_flag = entry.get("is_user") or entry.get("from_user")
        if role_raw in {"user", "human", "caller", "client"} or is_user_flag:
            sender = "user"
        elif role_raw in {"ai", "assistant", "agent", "bot", "system"}:
            sender = "ai"
        else:
            sender = "ai"

        normalized.append(
            {
                "sender": sender,
                "text": text,
                "time_in_call_secs": entry.get("time_in_call_secs"),
            }
        )
    return normalized


async def _persist_transcript_to_chat(
    db: AsyncSession,
    *,
    conversation_json: Dict[str, Any],
    chat_id: str,
    conversation_id: str,
    influencer_id: str | None = None,
) -> int:
    """
    Store ElevenLabs transcript messages into our Message table for that chat.
    Returns how many messages were inserted.
    """
    transcript = conversation_json.get("transcript") or []
    if not transcript:
        return 0
    chat = await db.get(Chat, chat_id)
    user_id = chat.user_id if chat else None
    resolved_influencer_id = influencer_id or (chat.influencer_id if chat else None)
    if not chat:
        log.warning(
            log.warning(
                "_persist_transcript.chat_not_found conv=%s chat=%s",
                conversation_id,
                chat_id,
            )
        )
    moderation_enabled = bool(user_id and resolved_influencer_id)
    start_ts = (conversation_json.get("metadata") or {}).get("start_time_unix_secs")
    base_dt = (
        datetime.utcfromtimestamp(start_ts)
        if isinstance(start_ts, (int, float))
        else datetime.utcnow()
    )

    recent_res = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.desc())
        .limit(25)
    )
    recent = list(recent_res.scalars().all())
    context_lines: List[str] = []
    new_messages: List[Message] = []
    seen: set[tuple[str, str]] = set()

    def _is_dup(sender: str, text: str) -> bool:
        if (sender, text) in seen:
            return True
        for msg in recent:
            if msg.sender == sender and (msg.content or "").strip() == text:
                return True
        return False

    # PHASE 1: Collect all message data without embedding
    pending_entries: List[Dict[str, Any]] = []

    for entry in transcript:
        text = str(
            entry.get("text") or entry.get("content") or entry.get("message") or ""
        ).strip()
        if not text:
            continue

        role_raw = str(
            entry.get("sender") or entry.get("role") or entry.get("speaker") or ""
        ).lower()
        is_user_flag = entry.get("is_user") or entry.get("from_user")
        if role_raw in {"user", "human", "caller", "client"} or is_user_flag:
            sender = "user"
        elif role_raw in {"ai", "assistant", "agent", "bot", "system"}:
            sender = "ai"
        else:
            sender = "ai"

        if _is_dup(sender, text):
            continue
        if moderation_enabled and sender == "user":
            context = "\n".join(context_lines[-6:]) if context_lines else ""
            try:
                mod_result = await moderate_message(text, context, db)
                if mod_result.action == "FLAG":
                    await handle_violation(
                        db=db,
                        user_id=user_id,
                        chat_id=chat_id,
                        influencer_id=resolved_influencer_id,
                        message=text,
                        context=context,
                        result=mod_result,
                    )
                    log.logging.warning(
                        "persist_transcript.violation chat=%s conv=%s msg=%s",
                        chat_id,
                        conversation_id,
                        text,
                    )
            except Exception as exc:
                log.exception(
                    "presist_transcript.moderation_failed chat=%s conv=%s err=%s",
                    chat_id,
                    conversation_id,
                    exc,
                )
        t_secs = entry.get("time_in_call_secs")
        created_at = (
            base_dt + timedelta(seconds=float(t_secs))
            if isinstance(t_secs, (int, float))
            else datetime.utcnow()
        )

        seen.add((sender, text))
        pending_entries.append(
            {
                "sender": sender,
                "text": text,
                "created_at": created_at,
            }
        )
        speaker = "User" if sender == "user" else "AI"
        context_lines.append(f"{speaker}: {text}")

    if not pending_entries:
        return 0

    # PHASE 2: Batch embed all texts in ONE API call (70-80% faster)
    texts_to_embed = [e["text"] for e in pending_entries]
    embeddings: List[Optional[List[float]]] = []
    try:
        from app.services.embeddings import get_embeddings_batch

        embeddings = await get_embeddings_batch(texts_to_embed)
    except Exception as exc:
        log.warning(
            "persist_transcript.batch_embed_failed chat=%s err=%s", chat_id, exc
        )
        embeddings = [None] * len(pending_entries)

    # PHASE 3: Create Message objects with embeddings
    for i, entry in enumerate(pending_entries):
        embedding = embeddings[i] if i < len(embeddings) else None
        new_messages.append(
            Message(
                chat_id=chat_id,
                sender=entry["sender"],
                channel="call",
                content=entry["text"],
                created_at=entry["created_at"],
                embedding=embedding,
                conversation_id=conversation_id,
            )
        )

    if not new_messages:
        return 0

    db.add_all(new_messages)
    await db.commit()
    try:
        history = redis_history(chat_id)
        for msg in new_messages:
            if msg.sender == "user":
                history.add_user_message(msg.content)
            else:
                history.add_ai_message(msg.content)
        try:
            max_len = settings.MAX_HISTORY_WINDOW
            if max_len and len(history.messages) > max_len:
                trimmed = history.messages[-max_len:]
                history.clear()
                history.add_messages(trimmed)
        except Exception:
            pass
    except Exception as exc:
        log.warning("persist_transcript.redis_sync_failed chat=%s err=%s", chat_id, exc)

    log.info(
        "persisted.transcript chat=%s conv=%s inserted=%d",
        chat_id,
        conversation_id,
        len(new_messages),
    )

    if transcript and chat_id:
        asyncio.create_task(
            extract_memories_from_transcript(
                chat_id=chat_id,
                transcript_entries=transcript,
                conversation_id=conversation_id,
            )
        )
        log.info(
            "[MEMORY-BG] scheduled from persist_transcript chat=%s conv=%s turns=%d",
            chat_id,
            conversation_id,
            len(transcript),
        )

    return len(new_messages)


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


async def save_pending_conversation(
    db: AsyncSession,
    conversation_id: str,
    user_id: int,
    influencer_id: Optional[str],
    sid: Optional[str],
    is_adult_call: bool = False,
    adult_character_id: int | None = None,
) -> Optional[str]:
    chat_id: Optional[str] = None
    if user_id and influencer_id:
        try:
            chat_id = await get_or_create_chat(db, user_id, influencer_id)
        except Exception as exc:
            log.warning(
                "save_pending_conversation.get_or_create_chat_failed user=%s infl=%s err=%s",
                user_id,
                influencer_id,
                exc,
            )
            chat_id = f"{user_id}_{influencer_id}"

    stmt = (
        pg_insert(CallRecord)
        .values(
            conversation_id=conversation_id,
            user_id=user_id,
            influencer_id=influencer_id,
            chat_id=chat_id,
            sid=sid,
            is_adult_call=is_adult_call,
            adult_character_id=adult_character_id,
            status="pending",
        )
        .on_conflict_do_update(
            index_elements=[CallRecord.conversation_id],
            set_={
                "user_id": user_id,
                "influencer_id": influencer_id,
                "chat_id": chat_id,
                "sid": sid,
                "is_adult_call": is_adult_call,
                "adult_character_id": adult_character_id,
                "status": "pending",
            },
        )
    )
    await db.execute(stmt)
    await db.commit()
    return chat_id


async def claim_billing_slot(db: AsyncSession, conversation_id: str) -> bool:
    """Atomically mark a conversation as billing-in-progress.

    Returns True if this call won the race (status flipped to 'billing').
    Returns False if it was already billed/billing (no rows affected).

    NOTE: Does NOT commit — the caller is responsible for committing after
    a successful charge, or resetting status on failure.
    """
    from sqlalchemy import update as sa_update

    result = await db.execute(
        sa_update(CallRecord)
        .where(
            CallRecord.conversation_id == conversation_id,
            CallRecord.status.notin_(["billing", "billed"]),
        )
        .values(status="billing")
    )
    await db.flush()
    return (result.rowcount or 0) > 0


async def mark_billing_done(db: AsyncSession, conversation_id: str) -> None:
    """Flip status from 'billing' → 'billed' after successful charge."""
    from sqlalchemy import update as sa_update

    await db.execute(
        sa_update(CallRecord)
        .where(CallRecord.conversation_id == conversation_id)
        .values(status="billed")
    )


async def reset_billing_slot(db: AsyncSession, conversation_id: str) -> None:
    """Reset status back to 'done' when charge fails, allowing retry."""
    from sqlalchemy import update as sa_update

    await db.execute(
        sa_update(CallRecord)
        .where(
            CallRecord.conversation_id == conversation_id,
            CallRecord.status == "billing",
        )
        .values(status="done")
    )
    await db.commit()


# Keep a thin backwards-compat wrapper so existing call-sites don't break
async def was_already_billed(db: AsyncSession, conversation_id: str) -> bool:
    q = select(CallRecord.status).where(CallRecord.conversation_id == conversation_id)
    res = await db.execute(q)
    row = res.first()
    return bool(row and row[0] == "billed")


async def _end_conversation_after_credits(
    conversation_id: str,
    user_id: int,
    influencer_id: str,
) -> None:
    """Sleep until the user's credit balance is exhausted, then end the call via ElevenLabs API."""
    try:
        async with SessionLocal() as db:
            feature, is_18 = await resolve_voice_billing_mode(
                db, user_id, influencer_id
            )
            remaining = await get_remaining_units(
                db, user_id, influencer_id, feature=feature, is_18=is_18
            )

        max_secs = compute_max_duration(remaining)
        if max_secs <= 0:
            max_secs = 1  # end immediately

        log.info(
            "credit_guard.scheduled conv=%s user=%s secs=%d",
            conversation_id,
            user_id,
            max_secs,
        )
        await asyncio.sleep(max_secs)
        try:
            snapshot = await _conversation_gateway.get_conversation_snapshot(
                conversation_id
            )
            status = (snapshot.get("status") or "").lower()
            if status in ("done", "failed"):
                log.info(
                    "credit_guard.already_ended conv=%s status=%s",
                    conversation_id,
                    status,
                )
                return
        except Exception:
            pass  # If we can't check status, try to end it anyway

        try:
            status_code = await _conversation_gateway.end_conversation(conversation_id)
            log.info(
                "credit_guard.ended conv=%s status=%d",
                conversation_id,
                status_code,
            )
        except Exception as exc:
            log.warning("credit_guard.end_failed conv=%s err=%s", conversation_id, exc)
    except Exception as exc:
        log.exception("credit_guard.fatal conv=%s err=%s", conversation_id, exc)


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
            _poll_and_persist_conversation(
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
                _end_conversation_after_credits(
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
            transcript = _normalize_transcript(snapshot)
        if duration is None:
            duration = _extract_total_seconds(snapshot)
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
