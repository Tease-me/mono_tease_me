"""Database seeding script for system prompts."""

import asyncio
from datetime import datetime, timezone
from sqlalchemy import delete, select
from app.data.enums import prompt_keys

from app.db.models import SystemPrompt
from app.db.session import SessionLocal
from app.data.prompts import get_all_prompts
from app.services.system_prompt_service import PROMPT_CACHE_PREFIX
from app.utils.infrastructure.redis_pool import get_redis


async def upsert_prompt(
    db, 
    key: str, 
    name: str, 
    prompt: str, 
    description: str | None, 
    type: str
) -> None:
    """Insert or skip existing prompt."""
    existing = await db.scalar(
        select(SystemPrompt).where(SystemPrompt.key == key)
    )

    if existing:
        if (
            existing.prompt == prompt
            and existing.name == name
            and existing.description == description
            and existing.type == type
        ):
            print(f"✓ Skipped {key} (unchanged)")
        else:
            existing.name = name
            existing.prompt = prompt
            existing.description = description
            existing.type = type
            existing.updated_at = datetime.now(timezone.utc)
            print(f"✓ Updated {key}")
    else:
        now = datetime.now(timezone.utc)
        db.add(
            SystemPrompt(
                key=key,
                name=name,
                prompt=prompt,
                type=type,
                description=description,
                created_at=now,
                updated_at=now,
            )
        )
        print(f"✓ Inserted {key}")


def get_defined_prompt_keys() -> set[str]:
    """Return prompt key values defined in app.constants.prompt_keys."""
    keys: set[str] = set()
    for name in dir(prompt_keys):
        if not name.isupper():
            continue
        value = getattr(prompt_keys, name)
        if isinstance(value, str):
            keys.add(value)
    return keys


async def delete_removed_prompt_seeds(db, valid_keys: set[str]) -> list[str]:
    """Delete DB prompt rows whose keys are no longer defined."""
    stale_keys = list(
        await db.scalars(
            select(SystemPrompt.key).where(SystemPrompt.key.notin_(valid_keys))
        )
    )
    if not stale_keys:
        return []

    await db.execute(delete(SystemPrompt).where(SystemPrompt.key.in_(stale_keys)))
    for key in stale_keys:
        print(f"✓ Deleted stale prompt seed {key}")
    return stale_keys


async def sync_redis_cache(keys_to_invalidate: set[str]) -> None:
    print("\n🔄 Syncing Redis cache...")
    try:
        redis = await get_redis()
        for key in sorted(keys_to_invalidate):
            cache_key = f"{PROMPT_CACHE_PREFIX}:{key}"
            await redis.delete(cache_key)
            print(f"  ✓ Invalidated {key}")
        print("✅ Redis cache synced.")
    except Exception as e:
        print(f"⚠️  Redis sync failed (cache will self-heal via TTL): {e}")


async def main():
    """Seed all prompts from registry."""
    all_prompts = get_all_prompts()
    valid_keys = get_defined_prompt_keys()
    if not valid_keys:
        raise RuntimeError("No prompt keys found in app.constants.prompt_keys")
    deleted_keys: list[str] = []
    
    async with SessionLocal() as db:
        for key, data in all_prompts.items():
            await upsert_prompt(
                db, 
                key, 
                data["name"], 
                data["prompt"], 
                data.get("description"), 
                data["type"]
            )
        deleted_keys = await delete_removed_prompt_seeds(db, valid_keys)
        await db.commit()
    
    await sync_redis_cache(set(all_prompts.keys()) | set(deleted_keys))
    
    print(
        f"\n✅ Done! Processed {len(all_prompts)} prompts, "
        f"deleted {len(deleted_keys)} stale prompts."
    )


if __name__ == "__main__":
    asyncio.run(main())
    # poetry run python -m app.scripts.seed_prompts
