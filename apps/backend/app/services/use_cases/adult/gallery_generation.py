"""Use cases for Grok-powered gallery variation generation and review."""

from __future__ import annotations

import base64
import io
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.data.models import CharacterStageVideoCandidate
from app.services.gateways import s3_gateway
from app.services.gateways.xai_imagine_gateway import (
    FACE_OUTFIT_MERGE_PROMPT,
    XaiImagineError,
    edit_images_multi,
    generate_image_variations,
)
from app.services.gateways.xai_imagine_video_gateway import (
    SUBTLE_LOOP_VIDEO_PROMPT,
    XaiImagineVideoError,
    generate_video_from_image,
)
from app.services.repositories.character_stage_video_repository import (
    STAGE_COUNT,
    VARIANT_COUNT,
    _presigned_url,
    build_stage_source_photo_key,
    copy_bytes_to_variant_mp4,
    copy_bytes_to_variant_poster,
    delete_stage_variant,
    get_gallery_state,
    list_stage_candidates,
    resolve_stage_source_key,
    load_outfit_reference_image,
    set_stage_variant_asset_key,
    upsert_stage_variant,
)

log = logging.getLogger(__name__)

_VARIATION_ACCENTS = (
    "slightly different head tilt and warm expression",
    "different subtle pose and gentle movement",
    "alternate angle with a soft playful look",
    "distinct micro-expression while staying natural",
    "another natural pose with varied eye contact",
)


def _variation_prompt(base_prompt: str, index: int, total: int) -> str:
    if total <= 1:
        return base_prompt
    accent = _VARIATION_ACCENTS[index % len(_VARIATION_ACCENTS)]
    return f"{base_prompt} Variation {index + 1} of {total}: {accent}."


def _build_video_animation_prompt(mood_prompt: str) -> str:
    """Build a conservative image-to-video prompt — mood only, no big motion."""
    mood = mood_prompt.strip()
    if not mood:
        return SUBTLE_LOOP_VIDEO_PROMPT
    first_sentence = mood.split(".")[0].strip()
    if not first_sentence:
        return SUBTLE_LOOP_VIDEO_PROMPT
    return f"Facial mood: {first_sentence}. {SUBTLE_LOOP_VIDEO_PROMPT}"


def _build_stage_pose_prompt(*, title: str = "", description: str = "") -> str:
    mood = ". ".join(part for part in (title.strip(), description.strip()) if part)
    if not mood:
        mood = "natural warm expression"
    return (
        "Same person, outfit, hairstyle, body pose, and background as the reference image. "
        f"Only adjust facial expression for this mood: {mood}. "
        "Do not change pose, camera angle, or environment. Photorealistic single frame."
    )


async def _apply_stage_pose_to_poster(
    merged_bytes: bytes,
    merged_content_type: str,
    *,
    stage_title: str = "",
    stage_description: str = "",
) -> tuple[bytes, str]:
    """Derive a stage-specific still from the merged face+outfit image."""
    pose_prompt = _build_stage_pose_prompt(
        title=stage_title,
        description=stage_description,
    )
    try:
        results = await generate_image_variations(
            source_image_bytes=merged_bytes,
            source_content_type=merged_content_type,
            prompt=pose_prompt,
            n=1,
        )
    except XaiImagineError:
        raise
    except Exception:
        log.warning("gallery.stage_pose_failed falling_back_to_merged", exc_info=True)
        return merged_bytes, merged_content_type

    if not results:
        return merged_bytes, merged_content_type

    item = results[0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"]), "image/png"
    if item.get("url"):
        return await _download_image_bytes(item["url"])
    return merged_bytes, merged_content_type


MODERATION_SAFE_VIDEO_PROMPT = SUBTLE_LOOP_VIDEO_PROMPT


def _is_content_moderation_error(exc: Exception) -> bool:
    return "content moderation" in str(exc).lower()


def _format_video_error(exc: Exception) -> str:
    if _is_content_moderation_error(exc):
        return (
            "xAI rejected the video (content moderation). "
            "Retried with a safe prompt — if this persists, soften the stage video prompt."
        )
    return f"Video generation failed: {exc}"[:500]


async def _generate_looping_video_from_poster(
    *,
    poster_bytes: bytes,
    poster_content_type: str,
    prompt: str,
    stage_index: int,
) -> str:
    try:
        return await generate_video_from_image(
            source_image_bytes=poster_bytes,
            source_content_type=poster_content_type,
            prompt=prompt,
        )
    except XaiImagineVideoError as exc:
        if not _is_content_moderation_error(exc):
            raise
        log.warning(
            "gallery.video_moderation_rejected stage=%s retrying_with_safe_prompt",
            stage_index,
        )
        return await generate_video_from_image(
            source_image_bytes=poster_bytes,
            source_content_type=poster_content_type,
            prompt=MODERATION_SAFE_VIDEO_PROMPT,
        )


async def _persist_candidate_video(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    source_key: str,
    generation_prompt: str,
    poster_bytes: bytes,
    poster_content_type: str,
    batch_index: int = 0,
    grok_metadata: dict | None = None,
) -> CharacterStageVideoCandidate:
    candidate = CharacterStageVideoCandidate(
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        source_image_key=source_key,
        generation_prompt=generation_prompt,
        status="pending_review",
        grok_metadata={"batch_index": batch_index, **(grok_metadata or {})},
    )
    db.add(candidate)
    await db.flush()

    poster_key = (
        f"{_candidate_prefix(influencer_id, character_id, stage_index, candidate.id)}/poster.png"
    )
    try:
        s3_gateway.put_object(
            bucket=settings.BUCKET_NAME,
            key=poster_key,
            body=poster_bytes,
            content_type=poster_content_type,
        )
        candidate.generated_poster_key = poster_key

        video_url = await _generate_looping_video_from_poster(
            poster_bytes=poster_bytes,
            poster_content_type=poster_content_type,
            prompt=generation_prompt,
            stage_index=stage_index,
        )
        video_bytes_raw, video_content_type = await _download_video_bytes(video_url)
        mp4_key = (
            f"{_candidate_prefix(influencer_id, character_id, stage_index, candidate.id)}"
            "/video.mp4"
        )
        s3_gateway.put_object(
            bucket=settings.BUCKET_NAME,
            key=mp4_key,
            body=video_bytes_raw,
            content_type=video_content_type or "video/mp4",
        )
        candidate.generated_mp4_key = mp4_key
    except (XaiImagineVideoError, httpx.HTTPError) as exc:
        candidate.status = "failed"
        candidate.error_message = _format_video_error(exc)
        if _is_content_moderation_error(exc):
            log.warning(
                "gallery.candidate_video_moderation candidate_id=%s stage=%s",
                candidate.id,
                stage_index,
            )
        else:
            log.exception("gallery.candidate_video_failed candidate_id=%s", candidate.id)
    except Exception as exc:
        candidate.status = "failed"
        candidate.error_message = str(exc)[:500]
        log.exception("gallery.candidate_persist_failed candidate_id=%s", candidate.id)

    return candidate


def _candidate_prefix(
    influencer_id: str, character_id: int, stage_index: int, candidate_id: int
) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/characters/{character_id}/"
        f"stages/{stage_index}/candidates/{candidate_id}"
    )


async def _download_image_bytes(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/png").split(";", 1)[0]
        return response.content, content_type


async def _download_video_bytes(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "video/mp4").split(";", 1)[0]
        return response.content, content_type


async def upload_stage_source_photo(
    file_obj,
    content_type: str,
    influencer_id: str,
    character_id: int,
    stage_index: int,
) -> str:
    key = build_stage_source_photo_key(influencer_id, character_id, stage_index)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    return key


async def merge_face_with_default_outfit(
    *,
    face_image_bytes: bytes,
    face_content_type: str,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    default_artwork_key: str | None = None,
) -> str:
    """Merge uploaded face photo onto character default outfit via Grok multi-image edit."""
    try:
        outfit_bytes, outfit_content_type, _source = load_outfit_reference_image(
            influencer_id,
            character_id,
            default_artwork_key=default_artwork_key,
        )
    except ValueError:
        raise
    except RuntimeError as exc:
        raise ValueError(str(exc)) from exc

    try:
        results = await edit_images_multi(
            source_images=[
                (face_image_bytes, face_content_type),
                (outfit_bytes, outfit_content_type),
            ],
            prompt=FACE_OUTFIT_MERGE_PROMPT,
            n=1,
        )
    except XaiImagineError:
        raise
    except Exception as exc:
        log.exception("gallery.merge_face_outfit_failed stage=%s", stage_index)
        raise RuntimeError("Failed to merge face with default outfit") from exc

    if not results:
        raise RuntimeError("Grok returned no merged image")

    item = results[0]
    if item.get("b64_json"):
        merged_bytes = base64.b64decode(item["b64_json"])
        merged_content_type = "image/png"
    elif item.get("url"):
        merged_bytes, merged_content_type = await _download_image_bytes(item["url"])
    else:
        raise RuntimeError("Grok returned no image payload for face merge")

    key = build_stage_source_photo_key(influencer_id, character_id, stage_index)
    s3_gateway.put_object(
        bucket=settings.BUCKET_NAME,
        key=key,
        body=merged_bytes,
        content_type=merged_content_type,
    )
    return key


async def generate_looping_video_from_face(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    face_image_bytes: bytes,
    face_content_type: str,
    prompt: str,
    stage_title: str = "",
    stage_description: str = "",
    default_artwork_key: str | None = None,
    variation_count: int = 1,
) -> list[CharacterStageVideoCandidate]:
    """Merge face + default outfit/background, then create looping video(s) in one flow."""
    if stage_index < 1 or stage_index > STAGE_COUNT:
        raise ValueError(f"stage_index must be between 1 and {STAGE_COUNT}")

    animation_prompt = _build_video_animation_prompt(prompt)
    if not animation_prompt:
        raise ValueError("Generation prompt is required")

    source_key = await merge_face_with_default_outfit(
        face_image_bytes=face_image_bytes,
        face_content_type=face_content_type,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        default_artwork_key=default_artwork_key,
    )

    merged_bytes = s3_gateway.get_object_bytes(bucket=settings.BUCKET_NAME, key=source_key)
    merged_meta = s3_gateway.get_object(bucket=settings.BUCKET_NAME, key=source_key)
    merged_content_type = merged_meta.get("ContentType") or "image/png"

    count = min(max(1, variation_count), VARIANT_COUNT)
    created: list[CharacterStageVideoCandidate] = []

    for index in range(count):
        poster_bytes, poster_content_type = await _apply_stage_pose_to_poster(
            merged_bytes,
            merged_content_type,
            stage_title=stage_title,
            stage_description=stage_description,
        )
        candidate = await _persist_candidate_video(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            source_key=source_key,
            generation_prompt=animation_prompt,
            poster_bytes=poster_bytes,
            poster_content_type=poster_content_type,
            batch_index=index,
            grok_metadata={"flow": "face_outfit_loop"},
        )
        created.append(candidate)

    await db.commit()
    for candidate in created:
        await db.refresh(candidate)
    return created


async def get_stage_source_photo_url(
    influencer_id: str, character_id: int, stage_index: int
) -> str | None:
    key = build_stage_source_photo_key(influencer_id, character_id, stage_index)
    if not s3_gateway.object_exists(bucket=settings.BUCKET_NAME, key=key):
        return None
    return await _presigned_url(key)


async def generate_stage_variations(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
    prompt: str,
    variation_count: int = 5,
    default_artwork_key: str | None = None,
) -> list[CharacterStageVideoCandidate]:
    if stage_index < 1 or stage_index > STAGE_COUNT:
        raise ValueError(f"stage_index must be between 1 and {STAGE_COUNT}")

    source_key, _ = resolve_stage_source_key(
        influencer_id,
        character_id,
        stage_index,
        default_artwork_key=default_artwork_key,
    )
    if not source_key:
        raise ValueError(
            "No source photo available. Upload a stage photo or set the character default photo."
        )

    source_bytes = s3_gateway.get_object_bytes(bucket=settings.BUCKET_NAME, key=source_key)
    source_meta = s3_gateway.get_object(bucket=settings.BUCKET_NAME, key=source_key)
    source_content_type = source_meta.get("ContentType") or "image/jpeg"

    normalized_prompt = prompt.strip()
    if not normalized_prompt:
        raise ValueError("Generation prompt is required")

    count = min(variation_count, VARIANT_COUNT)
    created: list[CharacterStageVideoCandidate] = []

    for index in range(count):
        variation_prompt = _variation_prompt(normalized_prompt, index, count)
        try:
            results = await generate_image_variations(
                source_image_bytes=source_bytes,
                source_content_type=source_content_type,
                prompt=variation_prompt,
                n=1,
            )
        except XaiImagineError:
            raise
        except Exception as exc:
            log.exception("gallery.generate_variations_failed index=%s", index)
            raise RuntimeError("Failed to generate variations with Grok") from exc

        if not results:
            continue

        item = results[0]
        candidate = CharacterStageVideoCandidate(
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            source_image_key=source_key,
            generation_prompt=variation_prompt,
            status="pending_review",
            grok_metadata={"batch_index": index, "raw": item},
        )
        db.add(candidate)
        await db.flush()

        poster_key = f"{_candidate_prefix(influencer_id, character_id, stage_index, candidate.id)}/poster.png"
        try:
            if item.get("b64_json"):
                poster_file_bytes = base64.b64decode(item["b64_json"])
                content_type = "image/png"
            elif item.get("url"):
                poster_file_bytes, content_type = await _download_image_bytes(item["url"])
            else:
                candidate.status = "failed"
                candidate.error_message = "Grok returned no image payload"
                created.append(candidate)
                continue

            s3_gateway.upload_fileobj(
                io.BytesIO(poster_file_bytes),
                settings.BUCKET_NAME,
                poster_key,
                content_type=content_type,
            )
            candidate.generated_poster_key = poster_key

            try:
                video_url = await generate_video_from_image(
                    source_image_bytes=poster_file_bytes,
                    source_content_type=content_type,
                    prompt=_build_video_animation_prompt(normalized_prompt),
                )
                video_bytes_raw, video_content_type = await _download_video_bytes(video_url)
                mp4_key = (
                    f"{_candidate_prefix(influencer_id, character_id, stage_index, candidate.id)}"
                    "/video.mp4"
                )
                s3_gateway.put_object(
                    bucket=settings.BUCKET_NAME,
                    key=mp4_key,
                    body=video_bytes_raw,
                    content_type=video_content_type or "video/mp4",
                )
                candidate.generated_mp4_key = mp4_key
            except (XaiImagineVideoError, httpx.HTTPError) as exc:
                candidate.status = "failed"
                candidate.error_message = f"Video generation failed: {exc}"[:500]
                log.exception(
                    "gallery.candidate_video_failed candidate_id=%s",
                    candidate.id,
                )
        except Exception as exc:
            candidate.status = "failed"
            candidate.error_message = str(exc)[:500]
            log.exception("gallery.candidate_persist_failed candidate_id=%s", candidate.id)

        created.append(candidate)

    await db.commit()
    for candidate in created:
        await db.refresh(candidate)
    return created


async def approve_candidate(
    db: AsyncSession,
    *,
    candidate_id: int,
    variant_index: int,
    title: str | None = None,
    description: str | None = None,
    stage_context: str | None = None,
    scene_description: str | None = None,
    tags: list[str] | None = None,
    influencer_id: str | None = None,
    character_id: int | None = None,
) -> None:
    if variant_index < 1 or variant_index > VARIANT_COUNT:
        raise ValueError(f"variant_index must be between 1 and {VARIANT_COUNT}")

    result = await db.execute(
        select(CharacterStageVideoCandidate).where(CharacterStageVideoCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise ValueError("Candidate not found")
    if influencer_id is not None and candidate.influencer_id != influencer_id:
        raise ValueError("Candidate does not belong to this influencer")
    if character_id is not None and candidate.character_id != character_id:
        raise ValueError("Candidate does not belong to this character")
    if candidate.status != "pending_review":
        raise ValueError("Only pending candidates can be approved")
    if not candidate.generated_mp4_key:
        raise ValueError("Candidate has no generated looping video")
    if not candidate.generated_poster_key:
        raise ValueError("Candidate has no poster frame")

    poster_bytes = s3_gateway.get_object_bytes(
        bucket=settings.BUCKET_NAME,
        key=candidate.generated_poster_key,
    )
    video_bytes = s3_gateway.get_object_bytes(
        bucket=settings.BUCKET_NAME,
        key=candidate.generated_mp4_key,
    )
    variant_poster_key = await copy_bytes_to_variant_poster(
        poster_bytes,
        influencer_id=candidate.influencer_id,
        character_id=candidate.character_id,
        stage_index=candidate.stage_index,
        variant_index=variant_index,
    )
    variant_mp4_key = await copy_bytes_to_variant_mp4(
        video_bytes,
        influencer_id=candidate.influencer_id,
        character_id=candidate.character_id,
        stage_index=candidate.stage_index,
        variant_index=variant_index,
    )

    panel_description = (description or "").strip()
    match_description = (
        (scene_description or stage_context or candidate.generation_prompt) or ""
    ).strip()
    await upsert_stage_variant(
        db,
        influencer_id=candidate.influencer_id,
        character_id=candidate.character_id,
        stage_index=candidate.stage_index,
        variant_index=variant_index,
        title=title,
        description=panel_description or None,
        stage_context=stage_context,
        scene_description=match_description or None,
        tags=tags,
        propagate_stage_fields=True,
    )

    await set_stage_variant_asset_key(
        db,
        influencer_id=candidate.influencer_id,
        character_id=candidate.character_id,
        stage_index=candidate.stage_index,
        variant_index=variant_index,
        asset_type="poster",
        s3_key=variant_poster_key,
    )

    await set_stage_variant_asset_key(
        db,
        influencer_id=candidate.influencer_id,
        character_id=candidate.character_id,
        stage_index=candidate.stage_index,
        variant_index=variant_index,
        asset_type="mp4",
        s3_key=variant_mp4_key,
    )

    candidate.status = "approved"
    candidate.assigned_variant_index = variant_index
    candidate.reviewed_at = datetime.now(timezone.utc)
    candidate.updated_at = datetime.now(timezone.utc)
    await db.commit()


async def reject_candidate(
    db: AsyncSession,
    *,
    candidate_id: int,
    influencer_id: str | None = None,
    character_id: int | None = None,
) -> None:
    result = await db.execute(
        select(CharacterStageVideoCandidate).where(CharacterStageVideoCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise ValueError("Candidate not found")
    if influencer_id is not None and candidate.influencer_id != influencer_id:
        raise ValueError("Candidate does not belong to this influencer")
    if character_id is not None and candidate.character_id != character_id:
        raise ValueError("Candidate does not belong to this character")
    if candidate.status != "pending_review":
        raise ValueError("Only pending candidates can be rejected")

    if candidate.generated_poster_key:
        try:
            s3_gateway.delete_object(
                bucket=settings.BUCKET_NAME,
                key=candidate.generated_poster_key,
            )
        except Exception:
            log.warning("Failed to delete candidate poster %s", candidate.generated_poster_key)

    if candidate.generated_mp4_key:
        try:
            s3_gateway.delete_object(
                bucket=settings.BUCKET_NAME,
                key=candidate.generated_mp4_key,
            )
        except Exception:
            log.warning("Failed to delete candidate video %s", candidate.generated_mp4_key)

    candidate.status = "rejected"
    candidate.reviewed_at = datetime.now(timezone.utc)
    candidate.updated_at = datetime.now(timezone.utc)
    await db.commit()


def _delete_candidate_s3_assets(candidate: CharacterStageVideoCandidate) -> None:
    for key in (candidate.generated_poster_key, candidate.generated_mp4_key):
        if not key:
            continue
        try:
            s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
        except Exception:
            log.warning("Failed to delete candidate asset %s", key)


async def clear_stage_gallery(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
) -> None:
    if stage_index < 1 or stage_index > STAGE_COUNT:
        raise ValueError(f"stage_index must be between 1 and {STAGE_COUNT}")

    source_key = build_stage_source_photo_key(influencer_id, character_id, stage_index)
    if s3_gateway.object_exists(bucket=settings.BUCKET_NAME, key=source_key):
        try:
            s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=source_key)
        except Exception:
            log.warning("Failed to delete stage source photo %s", source_key)

    result = await db.execute(
        select(CharacterStageVideoCandidate).where(
            CharacterStageVideoCandidate.influencer_id == influencer_id,
            CharacterStageVideoCandidate.character_id == character_id,
            CharacterStageVideoCandidate.stage_index == stage_index,
        )
    )
    for candidate in result.scalars().all():
        _delete_candidate_s3_assets(candidate)
        await db.delete(candidate)

    for variant_index in range(1, VARIANT_COUNT + 1):
        await delete_stage_variant(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            variant_index=variant_index,
        )

    await db.commit()


async def get_stage_gallery_bundle(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    stage_index: int,
) -> dict:
    gallery = await get_gallery_state(db, influencer_id=influencer_id, character_id=character_id)
    stage = next((s for s in gallery["stages"] if s["stage_index"] == stage_index), None)
    candidates = await list_stage_candidates(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
    )
    source_photo_url = await get_stage_source_photo_url(
        influencer_id, character_id, stage_index
    )
    return {
        "stage": stage,
        "source_photo_url": source_photo_url,
        "candidates": candidates,
    }
