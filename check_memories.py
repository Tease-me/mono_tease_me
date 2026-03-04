"""
USAGE INSTRUCTIONS:
This script checks the 20 most recently extracted memories from the database.

To run this locally (if your database is running in Docker and reachable on localhost):
1. Make sure your local virtual environment is active or use Poetry.
2. Run: `poetry run python check_memories.py`

To run this directly inside the backend Docker container (if local environment lacks dependencies):
Run: `docker compose exec backend bash -c "PYTHONPATH=/app python check_memories.py"`
    (Adjust `/app` to whatever your backend working directory is in the container, if needed).

Alternatively, you can just query the database directly:
`docker compose exec db psql -U postgres -d teaseme -c "SELECT created_at, sender, substring(content for 50) as content FROM memories ORDER BY created_at DESC LIMIT 20;"`
"""

import asyncio
from dotenv import load_dotenv
load_dotenv()  # Ensure local DB_URL is loaded from .env

from app.db.session import SessionLocal
from app.models.memory import Memory
from sqlalchemy import select

async def main():
    async with SessionLocal() as db:
        res = await db.execute(select(Memory).order_by(Memory.created_at.desc()).limit(20))
        mems = res.scalars().all()
        for m in mems:
            print(f"[{m.created_at}] chat={m.chat_id} sender={m.sender}: {m.content}")

if __name__ == "__main__":
    asyncio.run(main())
