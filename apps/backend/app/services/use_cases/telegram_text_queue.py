from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable

from app.core.config import settings
from app.utils.infrastructure.redis_pool import get_redis

log = logging.getLogger(__name__)

SendText = Callable[[str, str | None], Awaitable[None]]
ProcessBatch = Callable[[str, int | None, SendText], Awaitable[None]]

_worker_tasks: dict[str, asyncio.Task[None]] = {}
_send_callbacks: dict[str, SendText] = {}
_processors: dict[str, ProcessBatch] = {}


def _queue_prefix(session_identity: str, influencer_id: str, telegram_user_id: int) -> str:
    return f"tg:text_queue:{session_identity}:{influencer_id}:{telegram_user_id}"


def _queue_items_key(prefix: str) -> str:
    return f"{prefix}:items"


def _queue_touched_key(prefix: str) -> str:
    return f"{prefix}:touched_at"


def _queue_lease_key(prefix: str) -> str:
    return f"{prefix}:lease"


async def enqueue_telegram_text_batch(
    *,
    session_identity: str,
    influencer_id: str,
    telegram_user_id: int,
    message_id: int | None,
    text: str,
    send_text: SendText,
    process_batch: ProcessBatch,
) -> None:
    prefix = _queue_prefix(session_identity, influencer_id, telegram_user_id)
    now = time.time()
    queue_ttl_seconds = settings.TELEGRAM_TEXT_QUEUE_TTL_SECONDS
    payload = json.dumps(
        {
            "message_id": message_id,
            "text": text,
            "created_at": now,
        }
    )

    redis = await get_redis()
    await redis.rpush(_queue_items_key(prefix), payload)
    await redis.expire(_queue_items_key(prefix), queue_ttl_seconds)
    await redis.set(_queue_touched_key(prefix), str(now), ex=queue_ttl_seconds)

    _send_callbacks[prefix] = send_text
    _processors[prefix] = process_batch

    existing_task = _worker_tasks.get(prefix)
    if existing_task is None or existing_task.done():
        _worker_tasks[prefix] = asyncio.create_task(_drain_queue(prefix))


async def _drain_queue(prefix: str) -> None:
    redis = await get_redis()
    lease_key = _queue_lease_key(prefix)
    lease_ttl_seconds = max(
        settings.TELEGRAM_TEXT_QUEUE_TTL_SECONDS,
        int(settings.TELEGRAM_TEXT_BATCH_WINDOW_SECONDS) + 30,
    )
    acquired = await redis.set(lease_key, "1", ex=lease_ttl_seconds, nx=True)
    if not acquired:
        return

    try:
        while True:
            touched_raw = await redis.get(_queue_touched_key(prefix))
            if touched_raw is None:
                return

            touched_at = float(touched_raw)
            wait_seconds = touched_at + settings.TELEGRAM_TEXT_BATCH_WINDOW_SECONDS - time.time()
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
                continue

            drained_items = await _drain_items(redis, prefix)
            if not drained_items:
                return

            send_text = _send_callbacks.get(prefix)
            process_batch = _processors.get(prefix)
            if send_text is None or process_batch is None:
                log.warning("telegram.text_queue_missing_callback prefix=%s", prefix)
                return

            aggregated_text, batch_message_id = _aggregate_items(drained_items)
            if aggregated_text:
                await process_batch(aggregated_text, batch_message_id, send_text)

            if not await redis.exists(_queue_items_key(prefix)):
                return
    except Exception:
        log.exception("telegram.text_queue_worker_failed prefix=%s", prefix)
    finally:
        _worker_tasks.pop(prefix, None)
        _send_callbacks.pop(prefix, None)
        _processors.pop(prefix, None)
        await redis.delete(lease_key)


async def _drain_items(redis, prefix: str) -> list[str]:
    queue_items_key = _queue_items_key(prefix)
    queue_touched_key = _queue_touched_key(prefix)
    return await redis.eval(
        """
        local items = redis.call("LRANGE", KEYS[1], 0, -1)
        redis.call("DEL", KEYS[1])
        redis.call("DEL", KEYS[2])
        return items
        """,
        2,
        queue_items_key,
        queue_touched_key,
    )


def _aggregate_items(items: list[str]) -> tuple[str, int | None]:
    messages: list[str] = []
    last_message_id: int | None = None
    for item in items:
        try:
            payload = json.loads(item)
        except json.JSONDecodeError:
            log.warning("telegram.text_queue_invalid_payload payload=%r", item)
            continue

        text = str(payload.get("text") or "").strip()
        if not text:
            continue
        messages.append(text)

        raw_message_id = payload.get("message_id")
        if isinstance(raw_message_id, int):
            last_message_id = raw_message_id

    return "\n".join(messages), last_message_id


async def _reset_telegram_text_queue_state() -> None:
    tasks = list(_worker_tasks.values())
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
    _worker_tasks.clear()
    _send_callbacks.clear()
    _processors.clear()
