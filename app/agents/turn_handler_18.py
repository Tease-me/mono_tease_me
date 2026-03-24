import asyncio
import logging
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

from app.db.models import Influencer, Message18, User
from app.agents.prompts import XAI_MODEL
from app.agents.prompt_utils import get_time_context
from app.utils.messaging.tts_sanitizer import sanitize_tts_text
from app.utils.logging.prompt_logging import log_prompt
from app.services.system_prompt_service import get_system_prompt
from app.data.enums import prompt_keys
from langchain_core.prompts import ChatPromptTemplate
from app.agents.callbacks import UsageTrackingCallback
log = logging.getLogger(__name__)


def _render_recent_ctx(rows: list[Message18]) -> list[BaseMessage]:

    msgs: list[BaseMessage] = []
    for m in rows:
        role = (m.sender or "").lower()
        txt = (m.content or "").strip()
        if not txt:
            continue

        ts = ""
        if hasattr(m, "created_at") and m.created_at:
            ts = f"[{m.created_at.strftime('%b %d, %-I:%M %p')}] "

        if role == "user":
            msgs.append(HumanMessage(content=f"{ts}{txt}"))
        else:
            msgs.append(AIMessage(content=f"{ts}{txt}"))

    return msgs


async def _load_recent_ctx_18(db, chat_id: str, limit: int = 12) -> list[BaseMessage]:
    q = (
        select(Message18)
        .where(Message18.chat_id == chat_id)
        .order_by(Message18.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(q)
    rows = list(res.scalars().all())
    rows.reverse() 
    return _render_recent_ctx(rows)


async def _build_user_name_block_18(db, user_id: int | None) -> str:
    user = None
    if user_id:
        try:
            user = await db.get(User, int(user_id))
        except Exception as exc:
            log.warning("_build_user_name_block_18: failed to fetch user %s: %s", user_id, exc)

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
                "If the user has told you to call them something else, use that preferred name instead."
            )

    return (
        "You don't know the user's name yet. "
        "If they've told you to call them something specific, use that preferred name instead. "
        "Otherwise, don't assume a name."
    )


async def handle_turn_18(
    *,
    message: str,
    chat_id: str,
    influencer_id: str,
    user_id: int,
    db,
    is_audio: bool = False,
    user_timezone: str | None = None,
) -> str:
    cid = uuid4().hex[:8]
    log.info("[%s] START(18) persona=%s chat=%s user=%s", cid, influencer_id, chat_id, user_id)

    # OPTIMIZATION: Fetch cached system prompts in parallel (Redis cache, no DB contention)
    # These are independent Redis lookups that benefit from parallel execution
    base_adult_prompt, base_audio_prompt = await asyncio.gather(
        get_system_prompt(db, prompt_keys.BASE_ADULT_PROMPT),
        get_system_prompt(db, prompt_keys.BASE_ADULT_AUDIO_PROMPT),
    )
    
    # Phase 2: DB operations sequentially (AsyncSession doesn't allow concurrent access)
    influencer = await db.get(Influencer, influencer_id)
    recent_ctx = await _load_recent_ctx_18(db, chat_id, limit=12)

    if not influencer:
        raise HTTPException(404, "Influencer not found")

    system_prompt = base_adult_prompt
    if is_audio and base_audio_prompt:
        system_prompt = f"{base_adult_prompt}\n{base_audio_prompt}"


    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("user", "{input}"),
        ]
    )
    
    # Generate simple time context instead of picking from mood arrays
    time_context = await get_time_context(db, user_timezone)

    user = await db.get(User, user_id) if user_id else None
    user_adult_prompt = user.custom_adult_prompt if user else None
    users_name = await _build_user_name_block_18(db, user_id)
    prompt = prompt.partial(
        influencer_name=influencer.display_name,
        user_prompt=user_adult_prompt or "", 
        history=recent_ctx, 
        mood=time_context,
        users_name=users_name,
    )
    chain = prompt | XAI_MODEL

    tracker = UsageTrackingCallback(
        category="18_voice" if is_audio else "18_chat",
        purpose="main_reply",
        user_id=user_id,
        influencer_id=influencer_id,
        chat_id=chat_id,
    )

    try:
        result = await chain.ainvoke(
            {"input": message},
            config={"callbacks": [tracker]}
        )
        log_prompt(
            log,
            prompt,
            cid=cid,
            input=message,
            history=recent_ctx,
            user_prompt=user_adult_prompt,
        )
        reply = getattr(result, "content", None) or str(result)

        if is_audio:
            return sanitize_tts_text(reply)

        return reply
    except Exception as e:
        log.error("[%s] LLM error: %s", cid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="LLM generation failed")
