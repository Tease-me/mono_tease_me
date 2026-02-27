import asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

from app.api.admin import get_api_usage_top_users
from app.models import User

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/teasemedb")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    class FakeUser:
        id = 1
        
    async with async_session() as db:
        res = await get_api_usage_top_users(period="all", current_user=FakeUser(), db=db)
        print("TOP USERS RESPONSE:")
        print(repr(res))
        
if __name__ == "__main__":
    asyncio.run(main())
