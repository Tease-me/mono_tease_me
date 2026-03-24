from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory import extract_memories_from_transcript
from app.agents.turn_handler import redis_history
from app.core.config import settings
from app.db.models import Chat, Message
from app.services.moderation import handle_violation, moderate_message

log = logging.getLogger(__name__)


async def persist_transcript_to_chat(
    db: AsyncSession,
    *,
    conversation_json: dict[str, Any],
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
            "persist_transcript.chat_not_found conv=%s chat=%s",
            conversation_id,
            chat_id,
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
    context_lines: list[str] = []
    new_messages: list[Message] = []
    seen: set[tuple[str, str]] = set()

    def _is_dup(sender: str, text: str) -> bool:
        if (sender, text) in seen:
            return True
        for msg in recent:
            if msg.sender == sender and (msg.content or "").strip() == text:
                return True
        return False

    pending_entries: list[dict[str, Any]] = []

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
                    log.warning(
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

    texts_to_embed = [e["text"] for e in pending_entries]
    embeddings: list[list[float] | None] = []
    try:
        from app.services.embeddings import get_embeddings_batch

        embeddings = await get_embeddings_batch(texts_to_embed)
    except Exception as exc:
        log.warning(
            "persist_transcript.batch_embed_failed chat=%s err=%s", chat_id, exc
        )
        embeddings = [None] * len(pending_entries)

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
