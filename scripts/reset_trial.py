"""Reset trial: delete all completed CallRecords for a Telegram user."""

import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, delete, func
from app.db.session import SessionLocal
from app.db.models import CallRecord


async def main():
    async with SessionLocal() as db:
        # Show all telegram call records
        rows = (await db.execute(
            select(
                CallRecord.telegram_user_id,
                func.count().label("calls"),
                func.coalesce(func.sum(CallRecord.call_duration_secs), 0).label("total_secs"),
            )
            .where(CallRecord.telegram_user_id.isnot(None))
            .group_by(CallRecord.telegram_user_id)
        )).all()

        if not rows:
            print("No Telegram call records found.")
            return

        print("Telegram trial usage:")
        for tg_id, calls, secs in rows:
            print(f"  tg_user={tg_id}  calls={calls}  used={secs:.1f}s")

        # Delete ALL telegram call records to reset trials
        result = await db.execute(
            delete(CallRecord).where(CallRecord.telegram_user_id.isnot(None))
        )
        await db.commit()
        print(f"\n✅ Deleted {result.rowcount} call record(s). All Telegram trials reset!")


if __name__ == "__main__":
    asyncio.run(main())
