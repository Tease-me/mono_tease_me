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
    TELEGRAM_AUDIO_SLOT,
    delete_asset,
    get_landing_asset_entry,
    get_landing_asset_key,
    get_presigned_url,
    object_exists,
    upload_landing_binary,
    upload_landing_image,
)

LANDING_ALL_SLOTS = tuple(LANDING_IMAGE_SLOTS) + tuple(LANDING_VIDEO_SLOTS)


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

    return {
        "influencer_id": influencer.id,
        "hero_png_key": resolved_entries["hero_png"]["s3_key"] if resolved_entries["hero_png"] else None,
        "hero_png_url": resolved_entries["hero_png"]["url"] if resolved_entries["hero_png"] else None,
        "signature_png_key": resolved_entries["signature_png"]["s3_key"] if resolved_entries["signature_png"] else None,
        "signature_png_url": resolved_entries["signature_png"]["url"] if resolved_entries["signature_png"] else None,
        "background_video_1_key": resolved_entries["background_video_1"]["s3_key"] if resolved_entries["background_video_1"] else None,
        "background_video_1_url": resolved_entries["background_video_1"]["url"] if resolved_entries["background_video_1"] else None,
        "background_video_1_content_type": resolved_entries["background_video_1"]["content_type"] if resolved_entries["background_video_1"] else None,
        "background_video_2_key": resolved_entries["background_video_2"]["s3_key"] if resolved_entries["background_video_2"] else None,
        "background_video_2_url": resolved_entries["background_video_2"]["url"] if resolved_entries["background_video_2"] else None,
        "background_video_2_content_type": resolved_entries["background_video_2"]["content_type"] if resolved_entries["background_video_2"] else None,
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
        "has_hero": resolved_entries["hero_png"] is not None,
        "has_signature": resolved_entries["signature_png"] is not None,
        "has_background_videos": (
            resolved_entries["background_video_1"] is not None
            and resolved_entries["background_video_2"] is not None
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


async def get_admin_telegram_welcome_audio_out(influencer: Influencer) -> dict[str, Any]:
    entry = await _resolve_entry(get_landing_asset_entry(influencer.assets_json, TELEGRAM_AUDIO_SLOT))
    if not entry:
        raise HTTPException(status_code=404, detail="Telegram welcome audio not found")

    return {
        "influencer_id": influencer.id,
        "key": entry["s3_key"],
        "url": entry["url"],
        "content_type": entry.get("content_type"),
        "updated_at": entry.get("updated_at"),
    }


async def upsert_admin_telegram_welcome_audio(
    db: AsyncSession,
    influencer: Influencer,
    audio: UploadFile,
) -> dict[str, Any]:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    previous_key = get_landing_asset_key(influencer.assets_json, TELEGRAM_AUDIO_SLOT)
    uploaded_key: str | None = None
    try:
        uploaded_key, content_type = await upload_landing_binary(
            io.BytesIO(audio_bytes),
            audio.filename,
            audio.content_type,
            influencer.id,
            TELEGRAM_AUDIO_SLOT,
            fallback_extension="mp3",
        )
        assets_json = _clone_assets_json(influencer)
        assets_json[TELEGRAM_AUDIO_SLOT] = {
            "s3_key": uploaded_key,
            "content_type": content_type,
            "updated_at": _utcnow_iso(),
        }
        influencer.assets_json = assets_json
        db.add(influencer)
        await db.commit()
        await db.refresh(influencer)
    except HTTPException:
        if uploaded_key and uploaded_key != previous_key:
            try:
                await delete_asset(uploaded_key)
            except Exception:
                pass
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        if uploaded_key and uploaded_key != previous_key:
            try:
                await delete_asset(uploaded_key)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Failed to save telegram welcome audio") from exc

    if previous_key and previous_key != uploaded_key:
        try:
            await delete_asset(previous_key)
        except Exception:
            pass

    return await get_admin_telegram_welcome_audio_out(influencer)


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

            if slot in LANDING_IMAGE_SLOTS:
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
