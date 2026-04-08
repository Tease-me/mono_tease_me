"""Reset Telegram trial usage and DM funnel state."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.gateways.telegram.session_manager import session_manager
from app.services.repositories import call_record_repository
from app.utils.infrastructure.redis_pool import get_redis

log = logging.getLogger(__name__)


async def reset_telegram_trial_state(
    db: AsyncSession,
) -> tuple[int, list[tuple[int, int, float]], int]:
    """Reset Telegram trial usage in DB and DM reply counters in Redis."""
    deleted, rows = await call_record_repository.delete_telegram_trials(db)

    telegram_account_ids = {
        session.get("telegram_id")
        for session in session_manager.list_sessions()
        if session.get("telegram_id") is not None
    }

    redis_deleted = 0
    if telegram_account_ids and rows:
        redis = await get_redis()
        for telegram_account_id in telegram_account_ids:
            session_identity = f"telegram_account:{telegram_account_id}"
            for telegram_user_id, _, _ in rows:
                key = f"tg:text_replies:{session_identity}:{telegram_user_id}"
                redis_deleted += int(await redis.delete(key) or 0)

    log.info(
        "admin.reset_telegram_trial_state deleted=%d users=%d redis_reply_counters_deleted=%d active_session_identities=%d",
        deleted,
        len(rows),
        redis_deleted,
        len(telegram_account_ids),
    )
    return deleted, list(rows), redis_deleted
