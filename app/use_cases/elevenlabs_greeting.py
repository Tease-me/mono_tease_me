import asyncio
import logging
import random
from datetime import datetime, timezone
from itertools import chain
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.prompt_utils import get_time_context
from app.agents.prompts import GREETING_GENERATOR
from app.agents.turn_handler import _build_user_name_block, redis_history
from app.constants import prompt_keys
from app.db.models import CallRecord, Chat, Influencer, Message, User
from app.db.models.chat import Memory
from app.db.session import SessionLocal
from app.services.system_prompt_service import get_system_prompt
from app.utils.logging.prompt_logging import log_prompt

log = logging.getLogger(__name__)

_GREETINGS: Dict[str, List[str]] = {
    "playful": [
        "Well, look who finally decided to show up.",
        "Oh hey! You actually have perfect timing.",
        "There you are. I was about to start talking to myself.",
        "Hey! Save me from boredom, will you?",
    ],
    "anna": [
        "Hiii! ✨ I was literally just checking my phone!",
        "Omg hi!! How is your day going??",
        "Yay! You're actually here! 👋",
    ],
    "bella": [
        "Hey... it's really nice to see you.",
        "Hi. I was hoping to catch you today.",
        "There you are. How have you been?",
    ],
}

_rr_index: Dict[str, int] = {}

_DOPAMINE_OPENERS: Dict[str, List[str]] = {
    "anna": [
        "Okay, you won't believe what just happened to me!",
        "I was just about to message you! telepathy?? ✨",
    ],
    "bella": [
        "My phone buzzed and I actually hoped it was you.",
        "I saw something today that totally reminded me of you.",
    ],
    "playful": [
        "I have a question, and I feel like only you would know the answer.",
        "Warning: I'm in a mood to distract you from whatever you're doing.",
    ],
}

_RANDOM_FIRST_GREETINGS: List[str] = [
    "Hello?",
    "Hello, this is {persona_name}. Who’s calling?",
    "Hi, who am I speaking with?",
]


def _add_natural_pause(text: Optional[str]) -> Optional[str]:
    if not text:
        return text
    if any(p in text for p in [",", "...", "…"]):
        return text
    words = text.split()
    if len(words) < 5:
        return text
    mid = max(2, len(words) // 2)
    words.insert(mid, ",")
    return " ".join(words)


def _pick_greeting(influencer_id: str, mode: str) -> str:
    options = _GREETINGS.get(influencer_id)
    if not options:
        all_opts = list(chain.from_iterable(_GREETINGS.values()))
        choice = random.choice(all_opts) if all_opts else "Hello!"
        return _add_natural_pause(choice) or "Hello!"
    if mode == "rr":
        i = _rr_index.get(influencer_id, -1) + 1
        i %= len(options)
        _rr_index[influencer_id] = i
        return _add_natural_pause(options[i]) or options[i]
    chosen = random.choice(options)
    return _add_natural_pause(chosen) or chosen


def _pick_dopamine_greeting(influencer_id: str) -> Optional[str]:
    options = _DOPAMINE_OPENERS.get(influencer_id) or _DOPAMINE_OPENERS.get("playful")
    if not options:
        return None
    return _add_natural_pause(random.choice(options))


def _pick_random_first_greeting(persona_name: str) -> str:
    choice = random.choice(_RANDOM_FIRST_GREETINGS) if _RANDOM_FIRST_GREETINGS else "Hello?"
    return choice.format(persona_name=persona_name)


def _format_history(messages: List[Message]) -> str:
    lines: List[str] = []
    for msg in messages:
        speaker = "User" if msg.sender == "user" else "AI"
        content = (msg.content or "").strip().replace("\n", " ")
        if not content:
            continue
        ts = ""
        if hasattr(msg, "created_at") and msg.created_at:
            ts = f"[{msg.created_at.strftime('%b %d, %-I:%M %p')}] "
        lines.append(f"{ts}{speaker}: {content}")
    return "\n".join(lines)


def _format_transcript_entries(transcript: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for entry in transcript:
        text = str(
            entry.get("text") or entry.get("content") or entry.get("message") or ""
        ).strip()
        if not text:
            continue
        role_raw = str(entry.get("sender") or entry.get("role") or "").lower()
        is_user_flag = entry.get("is_user") or entry.get("from_user")
        speaker = "User" if role_raw in {"user", "human"} or is_user_flag else "AI"
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


def _format_redis_history(chat_id: str, limit: int = 12) -> Optional[str]:
    try:
        history = redis_history(chat_id)
    except Exception as exc:
        log.warning("redis_history.fetch_failed chat=%s err=%s", chat_id, exc)
        return None
    if not history or not history.messages:
        return None

    lines: List[str] = []
    for msg in history.messages[-limit:]:
        role = getattr(msg, "type", "") or getattr(msg, "role", "")
        speaker = "User" if role in {"human", "user"} else "AI"
        content = getattr(msg, "content", "")
        if isinstance(content, list):
            parts: List[str] = []
            for part in content:
                if isinstance(part, dict):
                    parts.append(str(part.get("text", "")))
                else:
                    parts.append(str(part))
            content = " ".join(parts)
        content = str(content or "").strip()
        if content:
            lines.append(f"{speaker}: {content}")
    return "\n".join(lines) if lines else None


def _classify_gap(minutes: float) -> str:
    if minutes < 2:
        return "immediate"
    if minutes < 15:
        return "short"
    if minutes < 120:
        return "medium"
    if minutes < 1440:
        return "long"
    return "extended"


def _classify_call_ending(call: Optional[CallRecord]) -> str:
    if not call:
        return "normal"
    duration = call.call_duration_secs or 0
    if duration < 30:
        return "abrupt"
    if duration > 300:
        return "lengthy"
    return "normal"


def _extract_last_message(db_messages: List[Message], transcript: Optional[str]) -> str:
    if db_messages:
        for msg in db_messages:
            content = (msg.content or "").strip()
            if content and len(content) > 5:
                return content[:100]

    if transcript:
        lines = transcript.strip().split("\n")
        for line in reversed(lines):
            if ":" in line:
                text = line.split(":", 1)[-1].strip()
                if text and len(text) > 5:
                    return text[:100]
    return ""


async def _get_contextual_first_message_prompt(db: AsyncSession) -> ChatPromptTemplate:
    system_prompt = await get_system_prompt(db, prompt_keys.CONTEXTUAL_FIRST_MESSAGE)
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "Generate the greeting now. Output only the greeting text."),
        ]
    )


def _build_relationship_partial_vars(rel: Any | None) -> dict[str, Any]:
    if rel is None:
        return {}
    return {
        "relationship_state": getattr(rel, "state", ""),
        "trust": int(getattr(rel, "trust", 0) or 0),
        "closeness": int(getattr(rel, "closeness", 0) or 0),
        "attraction": int(getattr(rel, "attraction", 0) or 0),
        "safety": int(getattr(rel, "safety", 0) or 0),
        "exclusive_agreed": bool(getattr(rel, "exclusive_agreed", False)),
        "girlfriend_confirmed": bool(getattr(rel, "girlfriend_confirmed", False)),
    }


def _build_stage_partial_vars(
    rel: Any | None,
    stages: dict | None,
    influencer_stages: Any | None,
) -> dict[str, Any]:
    if rel is None:
        return {}
    rel_state = (getattr(rel, "state", "") or "").strip().upper()
    if not rel_state:
        return {}

    stage_prompt = ""
    influencer_stage_prompt = ""

    if stages:
        stage_prompt = stages.get(rel_state, "") or stages.get(rel_state.lower(), "")

    if influencer_stages:
        influencer_stage_prompt = (
            influencer_stages.get(rel_state, "")
            or influencer_stages.get(rel_state.lower(), "")
        )

    return {
        "stage_prompt": stage_prompt,
        "influencer_stage_prompt": influencer_stage_prompt,
    }


async def _generate_contextual_greeting(
    db: AsyncSession,
    chat_id: str,
    influencer_id: str,
    user_timezone: str | None = None,
    rel: Any | None = None,
    stages: dict | None = None,
    influencer_stages: Any | None = None,
) -> Optional[str]:
    if GREETING_GENERATOR is None:
        return None

    async def _fetch_messages_standalone() -> List[Message]:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Message)
                .where(Message.chat_id == chat_id)
                .order_by(Message.created_at.desc())
                .limit(8)
            )
            return list(result.scalars().all())

    async def _fetch_chat_standalone() -> Optional[Chat]:
        async with SessionLocal() as session:
            return await session.get(Chat, chat_id)

    async def _fetch_influencer_standalone() -> Optional[Influencer]:
        async with SessionLocal() as session:
            return await session.get(Influencer, influencer_id)

    async def _fetch_last_call_standalone(user_id: int) -> Optional[CallRecord]:
        async with SessionLocal() as session:
            result = await session.execute(
                select(CallRecord)
                .where(
                    CallRecord.user_id == user_id,
                    CallRecord.influencer_id == influencer_id,
                )
                .order_by(CallRecord.created_at.desc())
                .limit(1)
            )
            return result.scalar_one_or_none()

    try:
        db_messages, chat, influencer = await asyncio.gather(
            _fetch_messages_standalone(),
            _fetch_chat_standalone(),
            _fetch_influencer_standalone(),
        )
    except Exception as exc:
        log.warning("contextual_greeting.parallel_fetch_failed chat=%s err=%s", chat_id, exc)
        db_messages, chat, influencer = [], None, None

    user_id = chat.user_id if chat else None
    last_call: Optional[CallRecord] = None
    user: Optional[User] = None

    if user_id:
        async def _fetch_user_standalone() -> Optional[User]:
            async with SessionLocal() as session:
                return await session.get(User, user_id)

        try:
            last_call, user = await asyncio.gather(
                _fetch_last_call_standalone(user_id),
                _fetch_user_standalone(),
            )
        except Exception as exc:
            log.warning(
                "contextual_greeting.call_user_fetch_failed chat=%s user=%s infl=%s err=%s",
                chat_id,
                user_id,
                influencer_id,
                exc,
            )

    last_interaction: Optional[datetime] = None
    transcript: Optional[str] = None

    if not db_messages:
        try:
            transcript = _format_redis_history(chat_id)
        except Exception as exc:
            log.warning("contextual_greeting.redis_fallback_failed chat=%s err=%s", chat_id, exc)

    if db_messages:
        last_interaction = getattr(db_messages[0], "created_at", None) or last_interaction
        db_messages.reverse()
        transcript = _format_history(db_messages)

    if last_call and last_call.created_at:
        call_time = last_call.created_at
        if call_time.tzinfo is None:
            call_time = call_time.replace(tzinfo=timezone.utc)

        if last_interaction and last_interaction.tzinfo is None:
            last_interaction = last_interaction.replace(tzinfo=timezone.utc)

        if last_interaction is None or call_time > last_interaction:
            last_interaction = call_time

        if not transcript and last_call.transcript:
            transcript = _format_transcript_entries(last_call.transcript)

    gap_minutes: float = 0
    if last_interaction:
        now = datetime.now(timezone.utc) if last_interaction.tzinfo else datetime.utcnow()
        gap_minutes = (now - last_interaction).total_seconds() / 60

    gap_category = _classify_gap(gap_minutes)
    call_ending_type = _classify_call_ending(last_call)
    last_call_duration = last_call.call_duration_secs if last_call else 0
    last_message = _extract_last_message(db_messages, transcript)
    time_context = await get_time_context(db, user_timezone)
    persona_name = influencer.display_name if influencer and influencer.display_name else influencer_id

    if not transcript and not last_message:
        # Verify it's truly a first-time interaction by checking DB
        is_first = True
        try:
            async def _has_messages() -> bool:
                async with SessionLocal() as s:
                    r = await s.execute(
                        select(exists().where(Message.chat_id == chat_id))
                    )
                    return r.scalar()

            async def _has_calls() -> bool:
                if not user_id:
                    return False
                async with SessionLocal() as s:
                    r = await s.execute(
                        select(
                            exists().where(
                                CallRecord.user_id == user_id,
                                CallRecord.influencer_id == influencer_id,
                            )
                        )
                    )
                    return r.scalar()

            async def _has_memories() -> bool:
                async with SessionLocal() as s:
                    r = await s.execute(
                        select(exists().where(Memory.chat_id == chat_id))
                    )
                    return r.scalar()

            has_msgs, has_calls, has_mems = await asyncio.gather(
                _has_messages(), _has_calls(), _has_memories(),
            )
            is_first = not (has_msgs or has_calls or has_mems)
        except Exception as exc:
            log.warning("first_interaction_check_failed chat=%s err=%s", chat_id, exc)

        if is_first:
            # First-time interaction — personalised welcome
            user_nick = None
            if user:
                user_nick = (user.full_name or user.username or "").strip().split()[0] or None
            if user_nick:
                return f"Hey is this {user_nick} calling?..... i've been waiting for you!"
            return "Hey... i've been waiting for you!"
        # return _pick_random_first_greeting(persona_name)

    try:
        async def _fetch_user_name():
            async with SessionLocal() as session:
                return await _build_user_name_block(session, user_id)

        async def _fetch_cached_memories():
            """Read pre-computed memory summaries from Redis (populated by store_facts_batch)."""
            try:
                from app.utils.infrastructure.redis_pool import get_redis
                rclient = await get_redis()
                mem_val, ai_val = await asyncio.gather(
                    rclient.get(f"mem_summary:{chat_id}"),
                    rclient.get(f"ai_mem_summary:{chat_id}"),
                )
                return (mem_val or ""), (ai_val or "")
            except Exception as exc:
                log.warning("contextual_greeting.redis_mem_failed chat=%s err=%s", chat_id, exc)
                return "", ""

        users_name, (mem_block, ai_mem_block) = await asyncio.gather(
            _fetch_user_name(),
            _fetch_cached_memories(),
        )

        prompt = await _get_contextual_first_message_prompt(db)
        partial_vars = {
            "influencer_name": persona_name,
            "users_name": users_name,
            "gap_category": gap_category,
            "gap_minutes": str(round(gap_minutes, 1)),
            "call_ending_type": call_ending_type,
            "last_call_duration_secs": str(int(last_call_duration or 0)),
            "last_message": last_message or "(no recent message)",
            "history": transcript or "(no recent history)",
            "mood": time_context,
            "memories": mem_block or "No memories yet.",
            "ai_memories": ai_mem_block or "None yet.",
        }
        partial_vars.update(_build_relationship_partial_vars(rel))
        partial_vars.update(_build_stage_partial_vars(rel, stages, influencer_stages))
        expected = set(getattr(prompt, "input_variables", []) or [])
        filtered = {k: v for k, v in partial_vars.items() if k in expected}
        log_prompt(log, prompt, cid=f"first_msg:{chat_id}", **filtered)
        chain = prompt.partial(**filtered) | GREETING_GENERATOR

        llm_response = await chain.ainvoke({})
        greeting = _add_natural_pause((llm_response.content or "").strip())

        if greeting and greeting.startswith('"') and greeting.endswith('"'):
            greeting = greeting[1:-1]
        if greeting and greeting.startswith("'") and greeting.endswith("'"):
            greeting = greeting[1:-1]

        log.info(
            "contextual_greeting.generated chat=%s gap=%s ending=%s rel_included=%s greeting=%r",
            chat_id,
            gap_category,
            call_ending_type,
            rel is not None,
            greeting[:50] if greeting else None,
        )
        return greeting if greeting else None
    except Exception as exc:
        log.warning("Failed to generate contextual greeting for %s: %s", chat_id, exc)
        return _pick_dopamine_greeting(influencer_id)


async def build_call_greeting(
    *,
    db: AsyncSession,
    chat_id: str,
    influencer_id: str,
    user_timezone: str | None,
    greeting_mode: str,
    persona_name: str | None = None,
    rel: Any | None = None,
    stages: dict | None = None,
    influencer_stages: Any | None = None,
) -> str | None:
    greeting = await _generate_contextual_greeting(
        db,
        chat_id,
        influencer_id,
        user_timezone,
        rel,
        stages,
        influencer_stages,
    )
    if greeting:
        return greeting

    if not greeting_mode:
        return None

    _ = persona_name  # reserved for future override behavior
    return _pick_greeting(influencer_id, greeting_mode)
