
import asyncio
import math
import time
import logging
import json
import hmac

from hashlib import sha256
from typing import Optional, Any
from app.agents.prompts import CONVO_ANALYZER

from fastapi import APIRouter, Depends, HTTPException, Request, Header, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.session import get_db, SessionLocal
from app.services.billing import charge_feature, _get_influencer_id_from_chat, resolve_voice_billing_mode
from app.services.adult_character_billing import charge_adult_character_voice_call
from app.services.repositories.call_record import claim_billing_slot, mark_billing_done, reset_billing_slot
from app.services.use_cases.elevenlabs_transcript_persistence import persist_transcript_to_chat
from app.utils.elevenlabs_conversation import extract_total_seconds
from sqlalchemy import select
from app.data.models import CallRecord, Chat, Influencer
from app.agents.turn_handler import  handle_turn, redis_history, _messages_since_session_break
from app.agents.memory import find_similar_memories

from app.services.relationship.processor import process_relationship_turn


log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

ELEVENLABS_CONVAI_WEBHOOK_SECRET = settings.ELEVENLABS_CONVAI_WEBHOOK_SECRET

# ElevenLabs credit → micro-dollar conversion
# Pro plan: $99/month for 500k credits = $0.000198/credit
# 1 micro-dollar = $0.000001, so $0.000198 = 198 micro-dollars per credit
_ELEVENLABS_MICRODOLLARS_PER_CREDIT = 198


def _extract_cost_micros(data: dict) -> int | None:
    """Extract call cost from ElevenLabs webhook metadata and convert to micro-dollars."""
    md = data.get("metadata") or {}
    cost_credits = md.get("cost")
    if cost_credits is not None:
        try:
            credits = int(cost_credits)
            return int(credits * _ELEVENLABS_MICRODOLLARS_PER_CREDIT)
        except (ValueError, TypeError):
            pass
    return None


def _redact(val: Any) -> str:
    """Redact potentially sensitive IDs in logs; works for int/str/None."""
    if val is None:
        return "-"
    s = str(val)
    if len(s) <= 6:
        return "***"
    return f"{s[:3]}…{s[-2:]}"


def _serialize_relationship_data(rel: Any) -> dict[str, Any]:
    """Serialize relationship fields for API responses."""
    return {
        "user_id": rel.user_id,
        "influencer_id": rel.influencer_id,
        "trust": rel.trust,
        "closeness": rel.closeness,
        "attraction": rel.attraction,
        "safety": rel.safety,
        "state": rel.state,
        "sentiment_score": rel.sentiment_score,
        "sentiment_delta": rel.sentiment_delta,
        "exclusive_agreed": rel.exclusive_agreed,
        "girlfriend_confirmed": rel.girlfriend_confirmed,
        "last_interaction_at": rel.last_interaction_at.isoformat() if rel.last_interaction_at else None,
        "updated_at": rel.updated_at.isoformat() if rel.updated_at else None,
    }


def _verify_hmac(raw_body: bytes, signature_header: Optional[str]) -> None:
    """
    Verify ElevenLabs HMAC signature.
    Header format: 't=<timestamp>,v0=<hex>' where v0 is HMAC_SHA256(f"{t}.{body}")
    using ELEVENLABS_CONVAI_WEBHOOK_SECRET.
    """
    if not ELEVENLABS_CONVAI_WEBHOOK_SECRET:
        log.error("webhook.hmac.missing_secret")
        raise HTTPException(500, "ELEVENLABS_CONVAI_WEBHOOK_SECRET not configured")
    if not signature_header:
        log.warning("webhook.hmac.missing_signature_header")
        raise HTTPException(401, "Missing ElevenLabs-Signature")

    try:
        parts = dict(p.split("=", 1) for p in signature_header.split(","))
        ts_str = parts["t"]
        v0 = parts["v0"]
        ts = int(ts_str)
    except Exception:
        log.warning("webhook.hmac.malformed_header header=%s", signature_header)
        raise HTTPException(401, "Malformed ElevenLabs-Signature")

    now = int(time.time())
    if ts < now - 30 * 60:
        log.warning("webhook.hmac.stale_signature ts=%s now=%s skew=%ss", ts, now, now - ts)
        raise HTTPException(401, "Stale signature")

    msg = f"{ts}.{raw_body.decode('utf-8')}".encode("utf-8")
    mac = hmac.new(ELEVENLABS_CONVAI_WEBHOOK_SECRET.encode("utf-8"), msg, sha256).hexdigest()
    expected = "v0=" + mac
    provided = v0 if v0.startswith("v0=") else "v0=" + v0

    if not hmac.compare_digest(provided, expected):
        log.warning(
            "webhook.hmac.invalid_signature provided=%s expected_prefix=%s",
            provided[:10] + "…",
            expected[:10] + "…",
        )
        raise HTTPException(401, "Invalid signature")

    log.debug("webhook.hmac.valid ts=%s", ts)


async def _resolve_user_for_conversation(db, conversation_id: str):
    log.info("resolver.called conversation_id=%s", conversation_id)
    q = select(CallRecord.user_id, CallRecord.influencer_id, CallRecord.sid, CallRecord.chat_id)\
        .where(CallRecord.conversation_id == conversation_id)
    res = await db.execute(q)
    row = res.first()
    if not row:
        log.info("resolver.miss conversation_id=%s", conversation_id)
        return {"user_id": None, "influencer_id": None, "sid": conversation_id, "chat_id": None}
    user_id, influencer_id, sid, chat_id = row
    log.info("resolver.hit conversation_id=%s user_id=%s chat_id=%s", conversation_id, user_id, chat_id)
    return {"user_id": user_id, "influencer_id": influencer_id, "sid": sid or conversation_id, "chat_id": chat_id}


@router.post("/elevenlabs")
async def elevenlabs_post_call(request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "-"
    te = (request.headers.get("transfer-encoding") or "").lower()
    log.info("webhook.receive start ip=%s transfer_encoding=%s", client_ip, te)

    if te == "chunked":
        buf = bytearray()
        async for chunk in request.stream():
            buf.extend(chunk)
        raw = bytes(buf)
    else:
        raw = await request.body()

    log.debug("webhook.receive.body bytes=%d", len(raw))

    sig = request.headers.get("ElevenLabs-Signature") or request.headers.get("elevenlabs-signature")
    _verify_hmac(raw, sig)
    log.info("webhook.verified ip=%s", client_ip)

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        log.warning("webhook.json.invalid ip=%s", client_ip)
        raise HTTPException(400, "Invalid JSON payload")

    event_type = payload.get("type") 
    data = payload.get("data") or {}

    conversation_id = data.get("conversation_id")
    status = (data.get("status") or "done").lower()
    total_seconds = extract_total_seconds(data)
    transcript = data.get("transcript") or []

    log.info(
        "webhook.parsed type=%s conv_id=%s status=%s seconds=%s ip=%s",
        event_type, _redact(conversation_id), status, total_seconds, client_ip
    )

    if not conversation_id:
        log.warning("webhook.no_conversation_id ip=%s", client_ip)
        return {"ok": False, "reason": "no-conversation-id"}

    meta_map = await _resolve_user_for_conversation(db, conversation_id)
    user_id = meta_map.get("user_id") or data.get("user_id") 
    sid = meta_map.get("sid") or conversation_id
    chat_id = meta_map.get("chat_id")

    if status == "done" and user_id:
        meta = {
            "session_id": sid,
            "conversation_id": conversation_id,
            "status": status,
            "agent_id": data.get("agent_id"),
            "start_time_unix_secs": (data.get("metadata") or {}).get("start_time_unix_secs"),
            "has_audio": data.get("has_audio", False),
            "has_user_audio": data.get("has_user_audio", False),
            "has_response_audio": data.get("has_response_audio", False),
            "source": "webhook",
            "event_type": event_type,
        }
        log.info(     
            "webhook.billing.start user=%s conv_id=%s seconds=%s",
            _redact(user_id), _redact(conversation_id), total_seconds
        )
        try:
            if not chat_id:
                raise HTTPException(400, "Missing chat_id in meta for billing")

            # Resolve influencer_id BEFORE the billed check so it's available
            # for track_usage_bg regardless of billing outcome.
            influencer_id = (
                meta_map.get("influencer_id")
                or await _get_influencer_id_from_chat(db, chat_id)
            )

            # Atomic claim: returns True if WE flipped status → 'billing'.
            if not await claim_billing_slot(db, conversation_id):
                log.info(
                    "webhook.billing.skipped already_billed conv_id=%s",
                    _redact(conversation_id),
                )
            else:
                try:
                    call_record = await db.get(CallRecord, conversation_id)
                    if call_record and call_record.is_adult_call:
                        from app.services.repositories.adult.adult_conversation_repository import (
                            get_adult_character_by_id,
                        )

                        if call_record.adult_character_id is None:
                            raise HTTPException(400, "Missing adult_character_id for adult call billing")
                        character = await get_adult_character_by_id(db, call_record.adult_character_id)
                        if not character:
                            raise HTTPException(404, "Adult character not found for billing")
                        await charge_adult_character_voice_call(
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
                        feature, is_18 = await resolve_voice_billing_mode(db, user_id, influencer_id)

                        await charge_feature(
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
                except Exception as charge_exc:
                    log.exception(
                        "webhook.billing.charge_failed conv_id=%s err=%s — resetting billing slot",
                        _redact(conversation_id), charge_exc,
                    )
                    await reset_billing_slot(db, conversation_id)
                    raise

            from app.services.token_tracker import track_usage_bg
            cost_micros = _extract_cost_micros(data)
            log.info(
                "webhook.cost raw_credits=%s micros=%s conv_id=%s",
                (data.get("metadata") or {}).get("cost"),
                cost_micros,
                _redact(conversation_id),
            )
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

            log.info(
                "webhook.billing.success user=%s conv_id=%s seconds=%s",
                _redact(user_id), _redact(conversation_id), total_seconds
            )
        except Exception as e:
            log.exception(
                "webhook.billing.error user=%s conv_id=%s err=%s",
                _redact(user_id), _redact(conversation_id), repr(e)
            )
            raise

    else:
        reason = "not_done" if status != "done" else "no_user"
        log.info(
            "webhook.billing.skipped reason=%s conv_id=%s status=%s user=%s",
            reason, _redact(conversation_id), status, _redact(user_id)
        )

    # ── Persist transcript & extract memories (fire-and-forget) ──
    if transcript and chat_id and status == "done":
        influencer_id_for_transcript = (
            meta_map.get("influencer_id")
            or (await _get_influencer_id_from_chat(db, chat_id) if chat_id else None)
        )

        async def _bg_persist_transcript():
            async with SessionLocal() as bg_db:
                await persist_transcript_to_chat(
                    bg_db,
                    conversation_json=data,
                    chat_id=chat_id,
                    conversation_id=conversation_id,
                    influencer_id=influencer_id_for_transcript,
                )

        try:
            _bg_task = asyncio.create_task(_bg_persist_transcript())
            _bg_task.add_done_callback(
                lambda t: log.error(
                    "webhook.transcript_persist.bg_error conv_id=%s err=%s",
                    _redact(conversation_id), t.exception(),
                ) if t.exception() else None
            )
            log.info(
                "webhook.transcript_persist.scheduled conv_id=%s chat=%s turns=%d",
                _redact(conversation_id), chat_id, len(transcript),
            )
        except Exception as exc:
            log.warning(
                "webhook.transcript_persist.failed conv_id=%s err=%s",
                _redact(conversation_id), exc,
            )

    log.info(
        "webhook.response ok=True conv_id=%s status=%s seconds=%s",
        _redact(conversation_id), status, total_seconds
    )
    return {"ok": True, "conversation_id": conversation_id, "status": status, "total_seconds": int(total_seconds)}

@router.post("/update_relationship")
async def update_relationship_api(
    req: Request,
    background_tasks: BackgroundTasks,
    x_webhook_token: str | None = Header(default=None),
):
    _verify_token(ELEVENLABS_CONVAI_WEBHOOK_SECRET, x_webhook_token)
    
    # Parse JSON immediately (fast operation)
    try:
        payload = await req.json()
    except Exception as e:
        log.exception("[EL TOOL] Failed to parse JSON payload: %s", e)
        return {"status": "error", "message": "Invalid JSON"}
    
    # Extract data and queue background processing
    args = payload.get("arguments") or {}
    raw_text = (
        payload.get("text")
        or payload.get("input")
        or (args.get("text") if isinstance(args, dict) else None)
        or ""
    )
    user_text = str(raw_text).strip()
    conversation_id = payload.get("conversation_id")
    
    # Log for debugging (non-blocking)
    try:
        log.info("[EL TOOL] payload(head)=%s", str(payload)[:800])
    except Exception:
        pass
    
    # Queue background processing - return immediately
    background_tasks.add_task(
        _process_relationship_update,
        user_text,
        conversation_id,
    )
    
    return {"status": "received"}



async def _process_relationship_update(user_text: str, conversation_id: str):
    """Process relationship update in background without blocking webhook response."""
    if not user_text:
        log.warning("[EL TOOL BG] empty user_text")
        return

    if not conversation_id:
        log.warning("[EL TOOL BG] missing conversation_id")
        return

    # Create a dedicated session for this background task.
    # The request-scoped session from get_db() is closed before background tasks run,
    # which causes connection pool leaks.
    async with SessionLocal() as db:
        try:
            res = await db.execute(select(CallRecord).where(CallRecord.conversation_id == conversation_id))
            call = res.scalar_one_or_none()
        except Exception as e:
            log.exception("[EL TOOL BG] CallRecord lookup failed: %s", e)
            return

        if not call:
            log.warning("[EL TOOL BG] CallRecord not found for conv=%s", conversation_id)
            return

        user_id = call.user_id
        influencer_id = call.influencer_id
        chat_id = call.chat_id

        if not user_id or not influencer_id or not chat_id:
            log.warning(
                "[EL TOOL BG] incomplete CallRecord context conv=%s user=%s infl=%s chat=%s",
                conversation_id, user_id, influencer_id, chat_id
            )
            return

        history = redis_history(chat_id)

        if len(history.messages) > settings.MAX_HISTORY_WINDOW:
            trimmed = history.messages[-settings.MAX_HISTORY_WINDOW:]
            history.clear()
            history.add_messages(trimmed)

        recent_ctx = "\n".join(f"{m.type}: {m.content}" for m in _messages_since_session_break(history.messages)[-6:])

        influencer = await db.get(Influencer, influencer_id)
        if not influencer:
            log.warning("[EL TOOL BG] Influencer not found infl=%s conv=%s", influencer_id, conversation_id)
            return

        # Fast Redis cache read for memories (populated by store_facts_batch)
        mem_block, ai_mem_block = "", ""
        try:
            from app.utils.infrastructure.redis_pool import get_redis
            _rc = await get_redis()
            _mem_val, _ai_val = await asyncio.gather(
                _rc.get(f"mem_summary:{chat_id}"),
                _rc.get(f"ai_mem_summary:{chat_id}"),
            )
            mem_block = _mem_val or ""
            ai_mem_block = _ai_val or ""
        except Exception as _exc:
            log.warning("[EL TOOL BG] redis mem cache read failed conv=%s: %s", conversation_id, _exc)

        rel_pack = await process_relationship_turn(
            db=db,
            user_id=int(user_id),
            influencer_id=influencer_id,
            message=user_text,
            recent_ctx=recent_ctx,
            cid=f"el_{conversation_id}"[:16],
            convo_analyzer=CONVO_ANALYZER,
            influencer=influencer,
            memories=mem_block,
            ai_memories=ai_mem_block,
        )

        rel = rel_pack["rel"]
        days_idle = rel_pack["days_idle"]
        dtr_goal = rel_pack["dtr_goal"]
        relationship = _serialize_relationship_data(rel)
        log.info(
            "[EL TOOL BG] relationship_metrics conv=%s days_idle=%s dtr_goal=%s payload=%s",
            conversation_id,
            days_idle,
            dtr_goal,
            relationship,
        )
    return relationship

def _verify_token(shared: str, token: str | None) -> None:
    if not shared: 
        return
    if not token:
        raise HTTPException(status_code=403, detail="Missing webhook token")
    if not hmac.compare_digest(shared, token):
        raise HTTPException(status_code=403, detail="Invalid webhook token")

@router.post("/memories")
async def eleven_webhook_get_memories(
    req: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_token: str | None = Header(default=None),
):
    _verify_token(ELEVENLABS_CONVAI_WEBHOOK_SECRET, x_webhook_token)
    log.info("[MEMORIES] ── webhook hit ──")

    try:
        payload = await req.json()
    except Exception as e:
        log.warning("[MEMORIES] JSON parse failed: %s", e)
        return {"memories": []}

    log.info("[MEMORIES] payload(head)=%s", str(payload)[:800])

    # Simplified payload parsing
    user_text = str(
        payload.get("text") or 
        payload.get("input") or 
        payload.get("arguments", {}).get("text", "")
    ).strip()
    
    conversation_id = payload.get("conversation_id")
    log.info("[MEMORIES] user_text=%r conv=%s", user_text[:120] if user_text else "", conversation_id)
    
    if not user_text or not conversation_id:
        log.warning("[MEMORIES] early exit: user_text=%s conv=%s", bool(user_text), bool(conversation_id))
        return {"memories": []}

    # Quick lookup - fail fast
    try:
        call = await db.scalar(
            select(CallRecord).where(CallRecord.conversation_id == conversation_id)
        )
    except Exception as e:
        log.warning("[MEMORIES] CallRecord lookup failed: %s", str(e)[:100])
        return {"memories": []}

    chat_id = None
    influencer_id = None
    user_id = None

    if call and call.chat_id and call.influencer_id:
        chat_id = call.chat_id
        influencer_id = call.influencer_id
        user_id = call.user_id
    else:
        # Fallback: Check if there's a Message with this conversation_id
        from app.data.models import Message
        q = (
            select(Chat.id, Chat.influencer_id, Chat.user_id)
            .join(Message, Message.chat_id == Chat.id)
            .where(Message.conversation_id == conversation_id)
            .limit(1)
        )
        msg_res = await db.execute(q)
        msg_row = msg_res.first()
        if msg_row:
            chat_id, influencer_id, user_id = msg_row

    if not chat_id or not influencer_id:
        log.warning(
            "[MEMORIES] missing context for conv=%s (call AND message fallbacks failed)", conversation_id
        )
        return {"memories": []}
    
    log.info("[MEMORIES] resolved: chat=%s infl=%s user=%s", chat_id, influencer_id, user_id)

    started = time.perf_counter()
    memories = []
    
    try:
        from app.services.embeddings import get_embedding
        
        # Tighter embedding timeout
        emb_start = time.perf_counter()
        embedding = await asyncio.wait_for(
            get_embedding(user_text, source="call"),
            timeout=0.5,
        )
        emb_ms = int((time.perf_counter() - emb_start) * 1000)
        log.info("[MEMORIES] embedding ok ms=%d", emb_ms)
        
        # Query ONLY memories (not messages) - faster, single query
        mem_start = time.perf_counter()
        memories = await asyncio.wait_for(
            find_similar_memories(
                message=user_text,
                chat_id=chat_id,
                influencer_id=influencer_id,
                db=db,
                embedding=embedding,
            ),
            timeout=1.5,
        )
        mem_ms = int((time.perf_counter() - mem_start) * 1000)
        mem_count = len(memories) if isinstance(memories, list) else 0
        log.info("[MEMORIES] query ok ms=%d count=%d", mem_ms, mem_count)

        # Log the actual memories returned for debugging
        if isinstance(memories, list):
            for i, mem in enumerate(memories[:5]):
                preview = str(mem)[:120] if mem else "(empty)"
                log.info("[MEMORIES]   [%d] %s", i, preview)
            
    except asyncio.TimeoutError:
        phase_ms = int((time.perf_counter() - started) * 1000)
        log.warning("[MEMORIES] TIMEOUT at %dms conv=%s", phase_ms, conversation_id)
    except Exception as e:
        log.warning("[MEMORIES] FAILED conv=%s: %s", conversation_id, str(e)[:200])
    finally:
        total_ms = int((time.perf_counter() - started) * 1000)
        mem_count = len(memories) if isinstance(memories, list) else 0
        log.info(
            "[MEMORIES] ── done ── total_ms=%d count=%d conv=%s chat=%s infl=%s",
            total_ms, mem_count, conversation_id, chat_id, influencer_id,
        )

    return {"memories": memories if isinstance(memories, list) else []}


@router.post("/reply")
async def eleven_webhook_reply(
    req: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_token: str | None = Header(default=None),
):
    _verify_token(ELEVENLABS_CONVAI_WEBHOOK_SECRET, x_webhook_token)

    try:
        payload = await req.json()
    except Exception:
        return {"text": "Sorry, I didn’t catch that. Could you repeat?"}

    try:
        log.info("[EL TOOL] payload(head)=%s", str(payload)[:800])
    except Exception:
        pass

    args = payload.get("arguments") or {}
    raw_text = (
        payload.get("text")
        or payload.get("input")
        or (args.get("text") if isinstance(args, dict) else None)
        or ""
    )
    user_text = str(raw_text).strip()
    if not user_text:
        return {"text": "I didn’t catch that. Could you repeat?"}

    conversation_id = payload.get("conversation_id")
    if not conversation_id:
        log.warning("[EL TOOL] missing conversation_id in payload=%s", str(payload)[:300])
        return {"text": "I’m missing the call ID. Please try again."}

    try:
        res = await db.execute(
            select(CallRecord).where(CallRecord.conversation_id == conversation_id)
        )
        call = res.scalar_one_or_none()
    except Exception as e:
        log.exception("[EL TOOL] CallRecord lookup failed: %s", e)
        return {"text": "I had an internal issue looking up this call. Please try again."}

    user_id = None
    influencer_id = None
    chat_id = None

    if not call:
        res_chat = await db.execute(select(Chat).where(Chat.id == conversation_id))
        chat_record = res_chat.scalar_one_or_none()
        if not chat_record:
            log.warning("[EL TOOL] No CallRecord or Chat found for conv=%s", conversation_id)
            return {
                "text": (
                    "I lost track of this call on my side. "
                    "Please hang up and start a new one."
                )
            }
        user_id = chat_record.user_id
        influencer_id = chat_record.influencer_id
        chat_id = chat_record.id
    else:
        user_id = call.user_id
        influencer_id = call.influencer_id
        chat_id = call.chat_id

    if not user_id or not influencer_id or not chat_id:
        log.warning(
            "[EL TOOL] incomplete CallRecord context conv=%s user=%s infl=%s chat=%s",
            conversation_id, user_id, influencer_id, chat_id
        )
        return {
            "text": (
                "I’m having trouble with this call’s context. "
                "Let’s start fresh next time, okay?"
            )
        }

    try:
        res = await db.execute(select(Chat).where(Chat.id == chat_id))
        chat = res.scalar_one_or_none()
    except Exception as e:
        log.exception("[EL TOOL] Chat lookup failed: %s", e)
        return {"text": "I hit an error accessing our chat. Please try again later."}

    if not chat:
        log.warning(
            "[EL TOOL] Chat not found for conv=%s chat=%s user=%s infl=%s",
            conversation_id, chat_id, user_id, influencer_id
        )
        return {
            "text": (
                "I can’t find our previous messages right now. "
                "Let’s start again next time?"
            )
        }

    started = time.perf_counter()
    try:
        reply = await asyncio.wait_for(
            handle_turn(
                message=user_text,
                chat_id=chat_id,
                influencer_id=influencer_id,
                user_id=user_id,
                db=db,
                is_audio=True,
            ),
            timeout=8.5,
        )
    except asyncio.TimeoutError:
        reply = "One sec… could you say that again?"
    except Exception as e:
        log.exception("[EL TOOL] handle_turn failed: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error during turn handling")
    finally:
        ms = int((time.perf_counter() - started) * 1000)
        log.info(
            "[EL TOOL] reply ms=%d conv=%s user=%s infl=%s chat=%s",
            ms, conversation_id, user_id, influencer_id, chat_id
        )

    if isinstance(reply, str) and len(reply) > 320:
        reply = reply[:317] + "…"

    return {"text": reply}
