"""One-off script to backfill trial_exhausted funnel events.

Finds all Telegram users whose cumulative call duration >= 60s (trial limit)
but have no trial_exhausted event in the funnel table, and inserts one.

Usage:
    docker compose exec backend python -m scripts.backfill_trial_exhausted
    # or locally:
    poetry run python -m scripts.backfill_trial_exhausted
"""

import asyncio
import logging

from sqlalchemy import func, select, and_

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Trial limit in seconds (must match DEFAULT_TRIAL_SECS)
TRIAL_LIMIT = 60.0


async def main():
    from app.db.session import SessionLocal
    from app.db.models.chat import CallRecord
    from app.db.models.funnel import TelegramFunnelEvent

    async with SessionLocal() as db:
        # Find telegram users who used >= 60s of trial time
        exhausted_users = await db.execute(
            select(
                CallRecord.telegram_user_id,
                CallRecord.influencer_id,
                func.coalesce(func.sum(func.coalesce(CallRecord.call_duration_secs, 0)), 0).label("total_secs"),
                func.max(CallRecord.created_at).label("last_call_at"),
            )
            .where(CallRecord.telegram_user_id.isnot(None))
            .group_by(CallRecord.telegram_user_id, CallRecord.influencer_id)
            .having(
                func.coalesce(func.sum(func.coalesce(CallRecord.call_duration_secs, 0)), 0) >= TRIAL_LIMIT
            )
        )
        rows = exhausted_users.all()
        log.info("Found %d (telegram_user, influencer) pairs with >= %.0fs usage", len(rows), TRIAL_LIMIT)

        inserted = 0
        skipped = 0
        for row in rows:
            tg_user_id = row.telegram_user_id
            influencer_id = row.influencer_id
            total_secs = float(row.total_secs)
            last_call_at = row.last_call_at

            if not influencer_id:
                skipped += 1
                continue

            # Check if trial_exhausted already exists for this pair
            existing = await db.execute(
                select(TelegramFunnelEvent.id)
                .where(
                    and_(
                        TelegramFunnelEvent.event_type == "trial_exhausted",
                        TelegramFunnelEvent.telegram_user_id == tg_user_id,
                        TelegramFunnelEvent.influencer_id == influencer_id,
                    )
                )
                .limit(1)
            )
            if existing.scalar_one_or_none():
                log.info(
                    "SKIP tg_user=%s influencer=%s (already has trial_exhausted)",
                    tg_user_id, influencer_id,
                )
                skipped += 1
                continue

            # Insert backfilled event — use last_call_at as the timestamp
            event = TelegramFunnelEvent(
                event_type="trial_exhausted",
                telegram_user_id=tg_user_id,
                influencer_id=influencer_id,
                meta={"backfilled": True, "total_secs": round(total_secs, 1)},
                occurred_at=last_call_at,
            )
            db.add(event)
            inserted += 1
            log.info(
                "INSERT trial_exhausted tg_user=%s influencer=%s total=%.1fs",
                tg_user_id, influencer_id, total_secs,
            )

        await db.commit()
        log.info("Done: inserted=%d skipped=%d", inserted, skipped)


if __name__ == "__main__":
    asyncio.run(main())
