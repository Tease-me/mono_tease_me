"""Admin workflows for influencer landing and telegram asset management."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Influencer
from app.repositories.influencer_landing_assets_repository import (
    LANDING_IMAGE_SLOTS,
    LANDING_VIDEO_SLOTS,
    LEGACY_TELEGRAM_MEDIA_SLOT,
    TELEGRAM_AUDIO_SLOT,
    TELEGRAM_VIDEO_SLOT,
    delete_asset,
    get_landing_asset_entry,
    get_landing_asset_key,
    get_presigned_url,
    object_exists,
    upload_landing_binary,
    upload_landing_image,
    upload_landing_poster_jpg,
)

LANDING_ALL_SLOTS = tuple(LANDING_IMAGE_SLOTS) + tuple(LANDING_VIDEO_SLOTS)
TELEGRAM_ALL_SLOTS = (TELEGRAM_AUDIO_SLOT, TELEGRAM_VIDEO_SLOT)
_AUDIO_EXTENSIONS = {"mp3", "wav", "webm", "ogg", "aac", "m4a"}
_VIDEO_EXTENSIONS = {"mp4", "webm", "mov", "avi", "mpeg", "mpg", "m4v"}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clone_assets_json(influencer: Influencer) -> dict[str, Any]:
    return dict(influencer.assets_json) if isinstance(influencer.assets_json, dict) else {}


async def _resolve_entry(entry: dict[str, Any] | None) -> dict[str, Any] | None:
    if not entry:
        return None

    s3_key = entry.get("s3_key")
    if not isinstance(s3_key, str) or not s3_key:
        return None

    if not await object_exists(s3_key):
        return None

    resolved = dict(entry)
    resolved["url"] = get_presigned_url(s3_key)
    return resolved


def _get_telegram_audio_entry(assets_json: dict[str, Any] | None) -> dict[str, Any] | None:
    return get_landing_asset_entry(assets_json, TELEGRAM_AUDIO_SLOT)


def _get_telegram_video_entry(assets_json: dict[str, Any] | None) -> dict[str, Any] | None:
    return (
        get_landing_asset_entry(assets_json, TELEGRAM_VIDEO_SLOT)
        or get_landing_asset_entry(assets_json, LEGACY_TELEGRAM_MEDIA_SLOT)
    )


def _get_telegram_key(assets_json: dict[str, Any] | None, slot: str) -> str | None:
    return get_landing_asset_key(assets_json, slot)


def _is_audio_upload(media: UploadFile) -> bool:
    content_type = (media.content_type or "").split(";", 1)[0].strip().lower()
    if content_type:
        return content_type.startswith("audio/")

    filename = media.filename or ""
    if "." not in filename:
        return False
    extension = filename.rsplit(".", 1)[-1].lower()
    return extension in _AUDIO_EXTENSIONS


def _is_video_upload(media: UploadFile) -> bool:
    content_type = (media.content_type or "").split(";", 1)[0].strip().lower()
    if content_type:
        return content_type.startswith("video/")

    filename = media.filename or ""
    if "." not in filename:
        return False
    extension = filename.rsplit(".", 1)[-1].lower()
    return extension in _VIDEO_EXTENSIONS


async def build_admin_landing_assets_out(influencer: Influencer) -> dict[str, Any]:
    assets_json = influencer.assets_json if isinstance(influencer.assets_json, dict) else {}

    resolved_entries: dict[str, dict[str, Any] | None] = {}
    for slot in LANDING_ALL_SLOTS:
        resolved_entries[slot] = await _resolve_entry(get_landing_asset_entry(assets_json, slot))

    background_image_slots = (
        "background_image_1",
        "background_image_1_2x",
        "background_image_2",
        "background_image_2_2x",
        "background_image_3",
        "background_image_3_2x",
    )
    hero_slots = ("hero_png", "hero_png_2x")
    signature_slots = ("signature_png", "signature_png_2x")
    background_video_slots = (
        "background_video_1_mp4",
        "background_video_1_webm",
        "background_video_1_poster_jpg",
        "background_video_2_mp4",
        "background_video_2_webm",
        "background_video_2_poster_jpg",
    )

    return {
        "influencer_id": influencer.id,
        "hero_png_key": resolved_entries["hero_png"]["s3_key"] if resolved_entries["hero_png"] else None,
        "hero_png_url": resolved_entries["hero_png"]["url"] if resolved_entries["hero_png"] else None,
        "hero_png_2x_key": resolved_entries["hero_png_2x"]["s3_key"] if resolved_entries["hero_png_2x"] else None,
        "hero_png_2x_url": resolved_entries["hero_png_2x"]["url"] if resolved_entries["hero_png_2x"] else None,
        "signature_png_key": resolved_entries["signature_png"]["s3_key"] if resolved_entries["signature_png"] else None,
        "signature_png_url": resolved_entries["signature_png"]["url"] if resolved_entries["signature_png"] else None,
        "signature_png_2x_key": resolved_entries["signature_png_2x"]["s3_key"] if resolved_entries["signature_png_2x"] else None,
        "signature_png_2x_url": resolved_entries["signature_png_2x"]["url"] if resolved_entries["signature_png_2x"] else None,
        "background_video_1_mp4_key": resolved_entries["background_video_1_mp4"]["s3_key"] if resolved_entries["background_video_1_mp4"] else None,
        "background_video_1_mp4_url": resolved_entries["background_video_1_mp4"]["url"] if resolved_entries["background_video_1_mp4"] else None,
        "background_video_1_mp4_content_type": resolved_entries["background_video_1_mp4"]["content_type"] if resolved_entries["background_video_1_mp4"] else None,
        "background_video_1_webm_key": resolved_entries["background_video_1_webm"]["s3_key"] if resolved_entries["background_video_1_webm"] else None,
        "background_video_1_webm_url": resolved_entries["background_video_1_webm"]["url"] if resolved_entries["background_video_1_webm"] else None,
        "background_video_1_webm_content_type": resolved_entries["background_video_1_webm"]["content_type"] if resolved_entries["background_video_1_webm"] else None,
        "background_video_1_poster_jpg_key": resolved_entries["background_video_1_poster_jpg"]["s3_key"] if resolved_entries["background_video_1_poster_jpg"] else None,
        "background_video_1_poster_jpg_url": resolved_entries["background_video_1_poster_jpg"]["url"] if resolved_entries["background_video_1_poster_jpg"] else None,
        "background_video_2_mp4_key": resolved_entries["background_video_2_mp4"]["s3_key"] if resolved_entries["background_video_2_mp4"] else None,
        "background_video_2_mp4_url": resolved_entries["background_video_2_mp4"]["url"] if resolved_entries["background_video_2_mp4"] else None,
        "background_video_2_mp4_content_type": resolved_entries["background_video_2_mp4"]["content_type"] if resolved_entries["background_video_2_mp4"] else None,
        "background_video_2_webm_key": resolved_entries["background_video_2_webm"]["s3_key"] if resolved_entries["background_video_2_webm"] else None,
        "background_video_2_webm_url": resolved_entries["background_video_2_webm"]["url"] if resolved_entries["background_video_2_webm"] else None,
        "background_video_2_webm_content_type": resolved_entries["background_video_2_webm"]["content_type"] if resolved_entries["background_video_2_webm"] else None,
        "background_video_2_poster_jpg_key": resolved_entries["background_video_2_poster_jpg"]["s3_key"] if resolved_entries["background_video_2_poster_jpg"] else None,
        "background_video_2_poster_jpg_url": resolved_entries["background_video_2_poster_jpg"]["url"] if resolved_entries["background_video_2_poster_jpg"] else None,
        "background_image_1_key": resolved_entries["background_image_1"]["s3_key"] if resolved_entries["background_image_1"] else None,
        "background_image_1_url": resolved_entries["background_image_1"]["url"] if resolved_entries["background_image_1"] else None,
        "background_image_1_2x_key": resolved_entries["background_image_1_2x"]["s3_key"] if resolved_entries["background_image_1_2x"] else None,
        "background_image_1_2x_url": resolved_entries["background_image_1_2x"]["url"] if resolved_entries["background_image_1_2x"] else None,
        "background_image_2_key": resolved_entries["background_image_2"]["s3_key"] if resolved_entries["background_image_2"] else None,
        "background_image_2_url": resolved_entries["background_image_2"]["url"] if resolved_entries["background_image_2"] else None,
        "background_image_2_2x_key": resolved_entries["background_image_2_2x"]["s3_key"] if resolved_entries["background_image_2_2x"] else None,
        "background_image_2_2x_url": resolved_entries["background_image_2_2x"]["url"] if resolved_entries["background_image_2_2x"] else None,
        "background_image_3_key": resolved_entries["background_image_3"]["s3_key"] if resolved_entries["background_image_3"] else None,
        "background_image_3_url": resolved_entries["background_image_3"]["url"] if resolved_entries["background_image_3"] else None,
        "background_image_3_2x_key": resolved_entries["background_image_3_2x"]["s3_key"] if resolved_entries["background_image_3_2x"] else None,
        "background_image_3_2x_url": resolved_entries["background_image_3_2x"]["url"] if resolved_entries["background_image_3_2x"] else None,
        "has_hero": all(resolved_entries[slot] is not None for slot in hero_slots),
        "has_signature": all(resolved_entries[slot] is not None for slot in signature_slots),
        "has_background_videos": all(
            resolved_entries[slot] is not None for slot in background_video_slots
        ),
        "has_complete_background_images": all(
            resolved_entries[slot] is not None for slot in background_image_slots
        ),
        "updated_at": max(
            (
                str(entry.get("updated_at"))
                for entry in resolved_entries.values()
                if entry and entry.get("updated_at")
            ),
            default=None,
        ),
    }


async def build_admin_telegram_welcome_media_out(influencer: Influencer) -> dict[str, Any]:
    audio_entry = await _resolve_entry(_get_telegram_audio_entry(influencer.assets_json))
    video_entry = await _resolve_entry(_get_telegram_video_entry(influencer.assets_json))
    if not audio_entry and not video_entry:
        raise HTTPException(status_code=404, detail="Telegram welcome media not found")

    return {
        "influencer_id": influencer.id,
        "telegram_audio_key": audio_entry["s3_key"] if audio_entry else None,
        "telegram_audio_url": audio_entry["url"] if audio_entry else None,
        "telegram_audio_content_type": audio_entry.get("content_type") if audio_entry else None,
        "telegram_video_key": video_entry["s3_key"] if video_entry else None,
        "telegram_video_url": video_entry["url"] if video_entry else None,
        "telegram_video_content_type": video_entry.get("content_type") if video_entry else None,
        "has_audio": audio_entry is not None,
        "has_video": video_entry is not None,
        "updated_at": max(
            (
                str(entry.get("updated_at"))
                for entry in (audio_entry, video_entry)
                if entry and entry.get("updated_at")
            ),
            default=None,
        ),
    }


async def build_public_telegram_welcome_media_out(influencer: Influencer) -> dict[str, Any]:
    admin_out = await build_admin_telegram_welcome_media_out(influencer)
    return {
        "influencer_id": admin_out["influencer_id"],
        "telegram_audio_url": admin_out["telegram_audio_url"],
        "telegram_audio_content_type": admin_out["telegram_audio_content_type"],
        "telegram_video_url": admin_out["telegram_video_url"],
        "telegram_video_content_type": admin_out["telegram_video_content_type"],
        "has_audio": admin_out["has_audio"],
        "has_video": admin_out["has_video"],
        "updated_at": admin_out["updated_at"],
    }


async def upsert_admin_telegram_welcome_media(
    db: AsyncSession,
    influencer: Influencer,
    audio: UploadFile | None,
    video: UploadFile | None,
) -> dict[str, Any]:
    provided_files = {
        slot: file
        for slot, file in {
            TELEGRAM_AUDIO_SLOT: audio,
            TELEGRAM_VIDEO_SLOT: video,
        }.items()
        if file is not None
    }
    if not provided_files:
        raise HTTPException(status_code=400, detail="At least one telegram media file is required")

    previous_keys = {
        TELEGRAM_AUDIO_SLOT: _get_telegram_key(influencer.assets_json, TELEGRAM_AUDIO_SLOT),
        TELEGRAM_VIDEO_SLOT: (
            _get_telegram_key(influencer.assets_json, TELEGRAM_VIDEO_SLOT)
            or _get_telegram_key(influencer.assets_json, LEGACY_TELEGRAM_MEDIA_SLOT)
        ),
    }
    uploaded_keys: dict[str, str] = {}
    try:
        assets_json = _clone_assets_json(influencer)
        for slot, file in provided_files.items():
            if slot == TELEGRAM_AUDIO_SLOT and not _is_audio_upload(file):
                raise HTTPException(status_code=400, detail="Telegram welcome audio must be an audio file")
            if slot == TELEGRAM_VIDEO_SLOT and not _is_video_upload(file):
                raise HTTPException(status_code=400, detail="Telegram welcome video must be a video file")

            file_bytes = await file.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail=f"Empty {slot} file")

            fallback_extension = "mp3" if slot == TELEGRAM_AUDIO_SLOT else "mp4"
            s3_key, content_type = await upload_landing_binary(
                io.BytesIO(file_bytes),
                file.filename,
                file.content_type,
                influencer.id,
                slot,
                fallback_extension=fallback_extension,
            )
            uploaded_keys[slot] = s3_key
            assets_json[slot] = {
                "s3_key": s3_key,
                "content_type": content_type,
                "updated_at": _utcnow_iso(),
            }

        if TELEGRAM_VIDEO_SLOT in provided_files:
            assets_json.pop(LEGACY_TELEGRAM_MEDIA_SLOT, None)

        influencer.assets_json = assets_json
        db.add(influencer)
        await db.commit()
        await db.refresh(influencer)
    except HTTPException:
        await db.rollback()
        for slot, s3_key in uploaded_keys.items():
            if s3_key != previous_keys.get(slot):
                try:
                    await delete_asset(s3_key)
                except Exception:
                    pass
        raise
    except Exception as exc:
        await db.rollback()
        for slot, s3_key in uploaded_keys.items():
            if s3_key != previous_keys.get(slot):
                try:
                    await delete_asset(s3_key)
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail="Failed to save telegram welcome media") from exc

    for slot, previous_key in previous_keys.items():
        new_key = uploaded_keys.get(slot)
        if previous_key and new_key and previous_key != new_key:
            try:
                await delete_asset(previous_key)
            except Exception:
                pass

    return await build_admin_telegram_welcome_media_out(influencer)


async def upsert_admin_landing_assets(
    db: AsyncSession,
    influencer: Influencer,
    files_by_slot: dict[str, UploadFile | None],
) -> dict[str, Any]:
    provided_files = {slot: file for slot, file in files_by_slot.items() if file is not None}
    if not provided_files:
        raise HTTPException(status_code=400, detail="At least one asset file is required")

    previous_keys = {
        slot: get_landing_asset_key(influencer.assets_json, slot)
        for slot in provided_files
    }
    uploaded_keys: dict[str, str] = {}
    try:
        assets_json = _clone_assets_json(influencer)
        for slot, file in provided_files.items():
            file_bytes = await file.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail=f"Empty {slot} file")

            if slot in {"background_video_1_poster_jpg", "background_video_2_poster_jpg"}:
                s3_key, content_type = await upload_landing_poster_jpg(
                    io.BytesIO(file_bytes),
                    file.filename,
                    file.content_type,
                    influencer.id,
                    slot,
                )
            elif slot in LANDING_IMAGE_SLOTS:
                s3_key, content_type = await upload_landing_image(
                    io.BytesIO(file_bytes),
                    file.filename,
                    file.content_type,
                    influencer.id,
                    slot,
                )
            elif slot in LANDING_VIDEO_SLOTS:
                s3_key, content_type = await upload_landing_binary(
                    io.BytesIO(file_bytes),
                    file.filename,
                    file.content_type,
                    influencer.id,
                    slot,
                    fallback_extension="mp4",
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported asset slot: {slot}")

            uploaded_keys[slot] = s3_key
            assets_json[slot] = {
                "s3_key": s3_key,
                "content_type": content_type,
                "updated_at": _utcnow_iso(),
            }

        influencer.assets_json = assets_json
        db.add(influencer)
        await db.commit()
        await db.refresh(influencer)
    except HTTPException:
        await db.rollback()
        for slot, s3_key in uploaded_keys.items():
            if s3_key != previous_keys.get(slot):
                try:
                    await delete_asset(s3_key)
                except Exception:
                    pass
        raise
    except Exception as exc:
        await db.rollback()
        for slot, s3_key in uploaded_keys.items():
            if s3_key != previous_keys.get(slot):
                try:
                    await delete_asset(s3_key)
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail="Failed to save landing assets") from exc

    for slot, previous_key in previous_keys.items():
        new_key = uploaded_keys.get(slot)
        if previous_key and new_key and previous_key != new_key:
            try:
                await delete_asset(previous_key)
            except Exception:
                pass

    return await build_admin_landing_assets_out(influencer)
