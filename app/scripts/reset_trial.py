"""
Reset trial usage for a Telegram user (for testing).

Usage:
    poetry run python -m app.scripts.reset_trial [telegram_user_id]

If no user ID is provided, defaults to 7653781997.
"""
import asyncio
import sys

from sqlalchemy import update

from app.db.session import SessionLocal
from app.db.models.chat import CallRecord


async def reset_trial(tg_user_id: int):
    async with SessionLocal() as db:
        result = await db.execute(
            update(CallRecord)
            .where(CallRecord.telegram_user_id == tg_user_id)
            .values(call_duration_secs=0.0)
        )
        await db.commit()
        print(f"✅ Reset {result.rowcount} call record(s) for tg_user={tg_user_id}")
        print("   Trial timer is now back to 120s.")


if __name__ == "__main__":
    tg_user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 7653781997
    asyncio.run(reset_trial(tg_user_id))
