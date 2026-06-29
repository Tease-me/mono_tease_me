"""User gallery unlocks and listing."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import AdultCharacter, CharacterStageVideo, UserUnlockedStageVideo
from app.services.repositories.character_stage_video_repository import _presigned_url
from app.services.repositories.gallery_stages_repository import (
    get_gallery_stages_config,
    get_stage_from_config,
)
from app.services.repositories.influencer_character_assets_repository import (
    get_influencer_character_asset_state,
)


async def unlock_stage_video(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    conversation_id: str | None = None,
) -> None:
    stmt = (
        pg_insert(UserUnlockedStageVideo)
        .values(
            user_id=user_id,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            variant_index=variant_index,
            conversation_id=conversation_id,
        )
        .on_conflict_do_nothing(
            index_elements=[
                "user_id",
                "influencer_id",
                "character_id",
                "stage_index",
                "variant_index",
            ]
        )
    )
    await db.execute(stmt)
    await db.commit()


async def list_user_gallery(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
) -> dict:
    result = await db.execute(
        select(UserUnlockedStageVideo, CharacterStageVideo, AdultCharacter)
        .join(
            CharacterStageVideo,
            (UserUnlockedStageVideo.influencer_id == CharacterStageVideo.influencer_id)
            & (UserUnlockedStageVideo.character_id == CharacterStageVideo.character_id)
            & (UserUnlockedStageVideo.stage_index == CharacterStageVideo.stage_index)
            & (UserUnlockedStageVideo.variant_index == CharacterStageVideo.variant_index),
        )
        .join(AdultCharacter, UserUnlockedStageVideo.character_id == AdultCharacter.id)
        .where(
            UserUnlockedStageVideo.user_id == user_id,
            UserUnlockedStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.mp4_key.isnot(None),
        )
        .order_by(
            AdultCharacter.display_order.asc(),
            AdultCharacter.id.asc(),
            UserUnlockedStageVideo.stage_index.asc(),
            UserUnlockedStageVideo.unlocked_at.asc(),
        )
    )
    rows = result.all()
    if not rows:
        return {"influencer_id": influencer_id, "scenarios": []}

    scenarios: dict[int, dict] = {}
    stage_config_cache: dict[int, dict] = {}
    for unlock, variant, character in rows:
        if character.id not in scenarios:
            asset_state = await get_influencer_character_asset_state(
                influencer_id, character.id
            )
            stages_config = await get_gallery_stages_config(
                influencer_id, character.id, character.slug
            )
            stage_config_cache[character.id] = stages_config
            scenarios[character.id] = {
                "character_id": character.id,
                "slug": character.slug,
                "name": character.name,
                "display_order": character.display_order,
                "poster_url": asset_state.get("video_preview_png_url")
                or asset_state.get("photo_url"),
                "stages": [],
            }

        stages_config = stage_config_cache[character.id]
        stage_config = get_stage_from_config(stages_config, unlock.stage_index)
        title = (
            variant.title
            or stage_config.get("title")
            or f"Stage {unlock.stage_index}"
        )
        description = variant.description or stage_config.get("description")

        scenarios[character.id]["stages"].append(
            {
                "stage_index": unlock.stage_index,
                "variant_index": unlock.variant_index,
                "title": title,
                "description": description,
                "video_mp4_url": await _presigned_url(variant.mp4_key),
                "video_webm_url": await _presigned_url(variant.webm_key),
                "poster_url": await _presigned_url(variant.poster_key),
                "unlocked_at": unlock.unlocked_at,
            }
        )

    ordered = sorted(
        scenarios.values(),
        key=lambda item: (item["display_order"], item["character_id"]),
    )
    return {"influencer_id": influencer_id, "scenarios": ordered}
