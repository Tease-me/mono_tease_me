import asyncio
from app.db.session import SessionLocal
from app.data.prompts import get_all_prompts
from app.services.system_prompt_service import update_system_prompt

async def main():
    async with SessionLocal() as db:
        all_prompts = get_all_prompts()
        base_system = all_prompts["BASE_SYSTEM"]
        print("Updating BASE_SYSTEM in DB...")
        await update_system_prompt(
            db=db,
            key="BASE_SYSTEM",
            new_prompt=base_system["prompt"],
            description=base_system.get("description"),
            name=base_system.get("name"),
            prompt_type=base_system.get("type")
        )
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
