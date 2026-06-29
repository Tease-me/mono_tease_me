"""Repository for character stage gallery videos."""

from __future__ import annotations

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.data.models import CharacterStageVideo, CharacterStageVideoCandidate
from app.services.embeddings import get_embedding
from app.services.gateways import s3_gateway
from app.services.repositories.influencer_character_assets_repository import (
    build_influencer_character_photo_key,
    build_influencer_character_video_mp4_key,
    build_influencer_character_video_preview_png_key,
)
from app.services.video_frame import extract_sharpest_frame_png
from app.services.repositories.gallery_stages_repository import (
    normalize_stage_tags,
    tags_to_scene_description,
)
from app.services.asset_cache_service import (
    get_cached_presigned_url,
    invalidate_presigned_url,
    set_cached_presigned_url,
)

log = logging.getLogger(__name__)

STAGE_COUNT = 5
VARIANT_COUNT = 5

ASSET_VARIANTS = frozenset({"mp4", "webm", "poster"})


def _stage_variant_prefix(
    influencer_id: str, character_id: int, stage_index: int, variant_index: int
) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/characters/{character_id}/"
        f"stages/{stage_index}/variants/{variant_index}"
    )


def build_stage_source_photo_key(
    influencer_id: str, character_id: int, stage_index: int
) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/characters/{character_id}/"
        f"stages/{stage_index}/source.png"
    )


def build_stage_video_mp4_key(
    influencer_id: str, character_id: int, stage_index: int, variant_index: int
) -> str:
    return f"{_stage_variant_prefix(influencer_id, character_id, stage_index, variant_index)}/video.mp4"


def build_stage_video_webm_key(
    influencer_id: str, character_id: int, stage_index: int, variant_index: int
) -> str:
    return f"{_stage_variant_prefix(influencer_id, character_id, stage_index, variant_index)}/video.webm"


def build_stage_video_poster_key(
    influencer_id: str, character_id: int, stage_index: int, variant_index: int
) -> str:
    return f"{_stage_variant_prefix(influencer_id, character_id, stage_index, variant_index)}/poster.png"


async def _presigned_url(key: str | None) -> str | None:
    if not key:
        return None
    cached = await get_cached_presigned_url(key)
    if cached:
        return cached
    url = s3_gateway.generate_presigned_get_url(
        bucket=settings.BUCKET_NAME,
        key=key,
        expires=settings.S3_PRESIGNED_URL_TTL_SECONDS,
    )
    await set_cached_presigned_url(key, url)
    return url


def resolve_stage_source_key(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    *,
    default_artwork_key: str | None = None,
) -> tuple[str | None, bool]:
    """Return S3 key and whether it is the character default (not stage-specific upload)."""
    bucket = settings.BUCKET_NAME
    stage_key = build_stage_source_photo_key(influencer_id, character_id, stage_index)
    if s3_gateway.object_exists(bucket=bucket, key=stage_key):
        return stage_key, False

    photo_key = build_influencer_character_photo_key(influencer_id, character_id)
    if s3_gateway.object_exists(bucket=bucket, key=photo_key):
        return photo_key, True

    if default_artwork_key and s3_gateway.object_exists(bucket=bucket, key=default_artwork_key):
        return default_artwork_key, True

    return None, False


def load_outfit_reference_image(
    influencer_id: str,
    character_id: int,
    *,
    default_artwork_key: str | None = None,
) -> tuple[bytes, str, str]:
    """Return outfit/background bytes for Grok merge.

    Prefers a sharp still extracted from the call-screen scenario MP4 over the
    motion-blurred preview PNG.
    """
    bucket = settings.BUCKET_NAME

    mp4_key = build_influencer_character_video_mp4_key(influencer_id, character_id)
    if s3_gateway.object_exists(bucket=bucket, key=mp4_key):
        video_bytes = s3_gateway.get_object_bytes(bucket=bucket, key=mp4_key)
        frame_png = extract_sharpest_frame_png(video_bytes)
        return frame_png, "image/png", "scenario video frame"

    preview_key = build_influencer_character_video_preview_png_key(
        influencer_id, character_id
    )
    if s3_gateway.object_exists(bucket=bucket, key=preview_key):
        preview_bytes = s3_gateway.get_object_bytes(bucket=bucket, key=preview_key)
        preview_meta = s3_gateway.get_object(bucket=bucket, key=preview_key)
        content_type = preview_meta.get("ContentType") or "image/png"
        return preview_bytes, content_type, "call screen preview"

    if default_artwork_key and s3_gateway.object_exists(bucket=bucket, key=default_artwork_key):
        artwork_bytes = s3_gateway.get_object_bytes(bucket=bucket, key=default_artwork_key)
        artwork_meta = s3_gateway.get_object(bucket=bucket, key=default_artwork_key)
        content_type = artwork_meta.get("ContentType") or "image/png"
        return artwork_bytes, content_type, "default artwork"

    photo_key = build_influencer_character_photo_key(influencer_id, character_id)
    if s3_gateway.object_exists(bucket=bucket, key=photo_key):
        photo_bytes = s3_gateway.get_object_bytes(bucket=bucket, key=photo_key)
        photo_meta = s3_gateway.get_object(bucket=bucket, key=photo_key)
        content_type = photo_meta.get("ContentType") or "image/jpeg"
        return photo_bytes, content_type, "character photo"

    raise ValueError(
        "No scene reference. Upload the call-screen scenario video in "
        "Admin → Influencer → Characters first."
    )


def resolve_outfit_reference_key(
    influencer_id: str,
    character_id: int,
    *,
    default_artwork_key: str | None = None,
) -> str | None:
    """Return S3 key for outfit + background reference (legacy / display only)."""
    bucket = settings.BUCKET_NAME

    mp4_key = build_influencer_character_video_mp4_key(influencer_id, character_id)
    if s3_gateway.object_exists(bucket=bucket, key=mp4_key):
        return mp4_key

    preview_key = build_influencer_character_video_preview_png_key(
        influencer_id, character_id
    )
    if s3_gateway.object_exists(bucket=bucket, key=preview_key):
        return preview_key

    if default_artwork_key and s3_gateway.object_exists(bucket=bucket, key=default_artwork_key):
        return default_artwork_key

    photo_key = build_influencer_character_photo_key(influencer_id, character_id)
    if s3_gateway.object_exists(bucket=bucket, key=photo_key):
        return photo_key

    return None


async def upload_stage_video_asset(
    file_obj,
    content_type: str,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    *,
    asset_type: str,
) -> str:
    key_builders = {
        "mp4": build_stage_video_mp4_key,
        "webm": build_stage_video_webm_key,
        "poster": build_stage_video_poster_key,
    }
    if asset_type not in key_builders:
        raise ValueError(f"Invalid asset type: {asset_type}")
    key = key_builders[asset_type](influencer_id, character_id, stage_index, variant_index)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    await invalidate_presigned_url(key)
    return key


async def delete_stage_video_asset(key: str) -> None:
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
    await invalidate_presigned_url(key)


async def _get_or_create_row(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
) -> CharacterStageVideo:
    result = await db.execute(
        select(CharacterStageVideo).where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
            CharacterStageVideo.stage_index == stage_index,
            CharacterStageVideo.variant_index == variant_index,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = CharacterStageVideo(
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
    )
    db.add(row)
    await db.flush()
    return row


async def _maybe_embed(text: str | None) -> list[float] | None:
    normalized = (text or "").strip()
    if not normalized:
        return None
    try:
        return await get_embedding(normalized)
    except Exception:
        log.warning("gallery.embedding_skipped text_len=%d", len(normalized), exc_info=True)
        return None


async def upsert_stage_variant(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    title: str | None = None,
    description: str | None = None,
    stage_context: str | None = None,
    scene_description: str | None = None,
    tags: list[str] | None = None,
    propagate_stage_fields: bool = True,
) -> CharacterStageVideo:
    row = await _get_or_create_row(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
    )

    stage_context_embedding = None
    if stage_context is not None:
        stage_context_embedding = await _maybe_embed(stage_context)

    scene_description_embedding = None
    normalized_tags: list[str] | None = None
    if tags is not None:
        normalized_tags = normalize_stage_tags(tags, scene_description or "")
        scene_description = tags_to_scene_description(normalized_tags) if normalized_tags else None
    elif scene_description is not None:
        normalized_tags = normalize_stage_tags(None, scene_description)

    if scene_description is not None:
        scene_description_embedding = await _maybe_embed(scene_description)

    if propagate_stage_fields and any(
        v is not None for v in (title, description, stage_context, tags, scene_description)
    ):
        stage_rows_result = await db.execute(
            select(CharacterStageVideo).where(
                CharacterStageVideo.influencer_id == influencer_id,
                CharacterStageVideo.character_id == character_id,
                CharacterStageVideo.stage_index == stage_index,
            )
        )
        stage_rows = list(stage_rows_result.scalars().all())
        if not stage_rows:
            stage_rows = [row]
        for stage_row in stage_rows:
            if title is not None:
                stage_row.title = title.strip() or None
            if description is not None:
                stage_row.description = description.strip() or None
            if stage_context is not None:
                stage_row.stage_context = stage_context.strip() or None
                stage_row.stage_context_embedding = stage_context_embedding
            if tags is not None or scene_description is not None:
                stage_row.tags = normalized_tags or None
                stage_row.scene_description = scene_description
                stage_row.scene_description_embedding = scene_description_embedding
            stage_row.updated_at = datetime.now(timezone.utc)
    else:
        if title is not None:
            row.title = title.strip() or None
        if description is not None:
            row.description = description.strip() or None
        if stage_context is not None:
            row.stage_context = stage_context.strip() or None
            row.stage_context_embedding = stage_context_embedding

        if tags is not None or scene_description is not None:
            row.tags = normalized_tags or None
            row.scene_description = scene_description
            row.scene_description_embedding = scene_description_embedding

    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return row


async def set_stage_variant_asset_key(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    asset_type: str,
    s3_key: str,
) -> CharacterStageVideo:
    row = await _get_or_create_row(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
    )
    if asset_type == "mp4":
        row.mp4_key = s3_key
    elif asset_type == "webm":
        row.webm_key = s3_key
    elif asset_type == "poster":
        row.poster_key = s3_key
    else:
        raise ValueError(f"Invalid asset type: {asset_type}")
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_stage_variant(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
) -> None:
    result = await db.execute(
        select(CharacterStageVideo).where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
            CharacterStageVideo.stage_index == stage_index,
            CharacterStageVideo.variant_index == variant_index,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return
    for key in (row.mp4_key, row.webm_key, row.poster_key):
        if key:
            try:
                await delete_stage_video_asset(key)
            except Exception:
                pass
    await db.delete(row)
    await db.commit()


async def variant_row_urls(row: CharacterStageVideo) -> dict[str, str | None | bool]:
    return {
        "video_mp4_url": await _presigned_url(row.mp4_key),
        "video_webm_url": await _presigned_url(row.webm_key),
        "poster_url": await _presigned_url(row.poster_key),
        "has_mp4": bool(row.mp4_key),
        "has_webm": bool(row.webm_key),
        "has_poster": bool(row.poster_key),
    }


async def _variant_to_dict(row: CharacterStageVideo | None, variant_index: int) -> dict:
    if not row:
        return {
            "variant_index": variant_index,
            "scene_description": None,
            "tags": [],
            "video_mp4_url": None,
            "video_webm_url": None,
            "poster_url": None,
            "has_mp4": False,
            "has_webm": False,
            "has_poster": False,
        }
    return {
        "variant_index": variant_index,
        "scene_description": row.scene_description,
        "tags": row.tags or [],
        "video_mp4_url": await _presigned_url(row.mp4_key),
        "video_webm_url": await _presigned_url(row.webm_key),
        "poster_url": await _presigned_url(row.poster_key),
        "has_mp4": bool(row.mp4_key),
        "has_webm": bool(row.webm_key),
        "has_poster": bool(row.poster_key),
    }


async def copy_bytes_to_variant_poster(
    image_bytes: bytes,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    content_type: str = "image/png",
) -> str:
    key = build_stage_video_poster_key(
        influencer_id, character_id, stage_index, variant_index
    )
    s3_gateway.put_object(
        bucket=settings.BUCKET_NAME,
        key=key,
        body=image_bytes,
        content_type=content_type,
    )
    await invalidate_presigned_url(key)
    return key


async def copy_bytes_to_variant_mp4(
    video_bytes: bytes,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    content_type: str = "video/mp4",
) -> str:
    key = build_stage_video_mp4_key(
        influencer_id, character_id, stage_index, variant_index
    )
    s3_gateway.put_object(
        bucket=settings.BUCKET_NAME,
        key=key,
        body=video_bytes,
        content_type=content_type,
    )
    await invalidate_presigned_url(key)
    return key


async def list_stage_candidates(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
) -> list[dict]:
    result = await db.execute(
        select(CharacterStageVideoCandidate)
        .where(
            CharacterStageVideoCandidate.influencer_id == influencer_id,
            CharacterStageVideoCandidate.character_id == character_id,
            CharacterStageVideoCandidate.stage_index == stage_index,
        )
        .order_by(CharacterStageVideoCandidate.created_at.desc())
    )
    rows = list(result.scalars().all())
    output: list[dict] = []
    for row in rows:
        output.append(
            {
                "id": row.id,
                "stage_index": row.stage_index,
                "status": row.status,
                "generation_prompt": row.generation_prompt,
                "assigned_variant_index": row.assigned_variant_index,
                "error_message": row.error_message,
                "preview_url": await _presigned_url(row.generated_poster_key),
                "video_url": await _presigned_url(row.generated_mp4_key),
                "has_video": bool(row.generated_mp4_key),
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            }
        )
    return output


async def get_gallery_state(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    default_artwork_key: str | None = None,
) -> dict:
    result = await db.execute(
        select(CharacterStageVideo).where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
        )
    )
    rows = list(result.scalars().all())
    by_slot: dict[tuple[int, int], CharacterStageVideo] = {
        (row.stage_index, row.variant_index): row for row in rows
    }

    stages = []
    for stage_index in range(1, STAGE_COUNT + 1):
        stage_rows = [by_slot.get((stage_index, v)) for v in range(1, VARIANT_COUNT + 1)]
        reference = next((r for r in stage_rows if r is not None), None)
        variants = []
        for variant_index in range(1, VARIANT_COUNT + 1):
            row = by_slot.get((stage_index, variant_index))
            variants.append(await _variant_to_dict(row, variant_index))
        source_key, source_is_default = resolve_stage_source_key(
            influencer_id,
            character_id,
            stage_index,
            default_artwork_key=default_artwork_key,
        )
        source_photo_url = await _presigned_url(source_key) if source_key else None
        stages.append(
            {
                "stage_index": stage_index,
                "title": reference.title if reference else None,
                "description": reference.description if reference else None,
                "stage_context": reference.stage_context if reference else None,
                "source_photo_url": source_photo_url,
                "source_photo_is_default": source_is_default,
                "variants": variants,
                "candidates": await list_stage_candidates(
                    db,
                    influencer_id=influencer_id,
                    character_id=character_id,
                    stage_index=stage_index,
                ),
            }
        )

    return {
        "influencer_id": influencer_id,
        "character_id": character_id,
        "stages": stages,
    }


async def find_best_scene_variant(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    query_embedding: list[float],
    max_distance: float = 0.55,
) -> dict | None:
    from sqlalchemy import text

    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    result = await db.execute(
        text(
            """
            SELECT
                stage_index,
                variant_index,
                title,
                description,
                scene_description,
                mp4_key,
                webm_key,
                poster_key,
                scene_description_embedding <=> :embedding AS distance
            FROM character_stage_videos
            WHERE influencer_id = :influencer_id
              AND character_id = :character_id
              AND mp4_key IS NOT NULL
              AND scene_description_embedding IS NOT NULL
              AND scene_description_embedding <=> :embedding <= :max_distance
            ORDER BY distance ASC
            LIMIT 1
            """
        ),
        {
            "embedding": embedding_str,
            "influencer_id": influencer_id,
            "character_id": character_id,
            "max_distance": max_distance,
        },
    )
    row = result.mappings().first()
    if not row:
        return None

    return {
        "stage_index": row["stage_index"],
        "variant_index": row["variant_index"],
        "title": row["title"],
        "description": row["description"],
        "scene_description": row["scene_description"],
        "video_mp4_url": await _presigned_url(row["mp4_key"]),
        "video_webm_url": await _presigned_url(row["webm_key"]),
        "poster_url": await _presigned_url(row["poster_key"]),
        "distance": float(row["distance"]),
    }


async def _scene_variant_from_row(row: CharacterStageVideo) -> dict:
    tags = row.tags or normalize_stage_tags(None, row.scene_description or "")
    return {
        "stage_index": row.stage_index,
        "variant_index": row.variant_index,
        "title": row.title,
        "description": row.description,
        "scene_description": row.scene_description,
        "tags": tags,
        "stage_tag": tags[0] if tags else None,
        "video_mp4_url": await _presigned_url(row.mp4_key),
        "video_webm_url": await _presigned_url(row.webm_key),
        "poster_url": await _presigned_url(row.poster_key),
    }


async def get_first_available_scene_variant(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int | None = None,
    variant_index: int | None = None,
) -> dict | None:
    query = select(CharacterStageVideo).where(
        CharacterStageVideo.influencer_id == influencer_id,
        CharacterStageVideo.character_id == character_id,
        CharacterStageVideo.mp4_key.isnot(None),
    )
    if stage_index is not None:
        query = query.where(CharacterStageVideo.stage_index == stage_index)
    if variant_index is not None:
        query = query.where(CharacterStageVideo.variant_index == variant_index)
    query = query.order_by(
        CharacterStageVideo.stage_index.asc(),
        CharacterStageVideo.variant_index.asc(),
    )
    result = await db.execute(query)
    row = result.scalars().first()
    if not row:
        return None

    return await _scene_variant_from_row(row)


async def get_random_scene_variant(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    exclude_variant_index: int | None = None,
) -> dict | None:
    """Pick a random approved variant for one stage (among filled slots)."""
    result = await db.execute(
        select(CharacterStageVideo).where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
            CharacterStageVideo.stage_index == stage_index,
            CharacterStageVideo.mp4_key.isnot(None),
        )
    )
    rows = list(result.scalars().all())
    if exclude_variant_index is not None and len(rows) > 1:
        rows = [row for row in rows if row.variant_index != exclude_variant_index]
    if not rows:
        return None

    return await _scene_variant_from_row(random.choice(rows))


async def resolve_scene_variant_for_stage(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    min_stage_index: int = 1,
    exclude_variant_index: int | None = None,
) -> dict | None:
    """Pick a random variant for a stage, falling back to the nearest lower stage."""
    floor = max(1, min_stage_index)
    for stage in range(stage_index, floor - 1, -1):
        exclude = exclude_variant_index if stage == stage_index else None
        variant = await get_random_scene_variant(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage,
            exclude_variant_index=exclude,
        )
        if variant:
            return variant
    return None


async def reembed_scene_descriptions(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_scene_descriptions: dict[int, str] | None = None,
    stage_tags: dict[int, list[str]] | None = None,
) -> dict[str, int]:
    """Refresh tags, scene_description text and embeddings for gallery variant rows."""
    result = await db.execute(
        select(CharacterStageVideo).where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
        )
    )
    rows = list(result.scalars().all())
    updated = 0
    skipped = 0
    failed = 0

    for row in rows:
        config_tags = stage_tags.get(row.stage_index) if stage_tags else None
        config_text = (
            stage_scene_descriptions.get(row.stage_index)
            if stage_scene_descriptions
            else None
        )
        tags = normalize_stage_tags(config_tags, config_text or row.scene_description or "")
        if not tags:
            skipped += 1
            continue

        normalized = tags_to_scene_description(tags)

        try:
            embedding = await _maybe_embed(normalized)
            row.tags = tags
            row.scene_description = normalized
            row.scene_description_embedding = embedding
            row.updated_at = datetime.now(timezone.utc)
            updated += 1
        except Exception:
            failed += 1
            log.exception(
                "gallery.reembed_failed influencer=%s character=%s stage=%s variant=%s",
                influencer_id,
                character_id,
                row.stage_index,
                row.variant_index,
            )

    if updated > 0:
        await db.commit()

    return {
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "total": len(rows),
    }
