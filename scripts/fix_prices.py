import asyncio
import os
import sys

# Ensure app is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.session import SessionLocal
from app.data.models.api_usage import ApiUsageLog
from sqlalchemy import select

async def fix_prices():
    async with SessionLocal() as db:
        res = await db.execute(select(ApiUsageLog).where(
            ApiUsageLog.provider != "elevenlabs",
            ApiUsageLog.model != "whisper-1"
        ))
        
        logs = res.scalars().all()
        count = 0
        original_sum = 0
        new_sum = 0
        for log in logs:
            if log.estimated_cost_micros and log.estimated_cost_micros > 0:
                original_sum += log.estimated_cost_micros
                
                # Assume values larger than expected are nano-dollars that need to be micro-dollars
                log.estimated_cost_micros = int(log.estimated_cost_micros / 1000)
                new_sum += log.estimated_cost_micros
                
                db.add(log)
                count += 1
                
        await db.commit()
        print(f"Fixed {count} usage logs.")
        print(f"Original total micro-dollars value: {original_sum} -> New total: {new_sum}")
        print(f"Original USD representation: ${original_sum/1000000:.2f} -> New USD representation: ${new_sum/1000000:.2f}")

if __name__ == "__main__":
    asyncio.run(fix_prices())
