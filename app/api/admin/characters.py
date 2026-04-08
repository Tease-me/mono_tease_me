import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.models import AdultCharacter, Influencer, InfluencerCharacterMeta, User
from app.core.session import get_db
from app.services.repositories.adult_character_assets_repository import (
    get_adult_character_asset_state,
    invalidate_adult_character_asset_cache,
    upload_adult_character_default_artwork,
    upload_adult_character_lottie,
)
from app.services.repositories.influencer_character_assets_repository import (
    delete_influencer_character_asset,
    get_influencer_character_asset_keys,
    get_influencer_character_asset_presence,
    get_influencer_character_asset_state,
    invalidate_influencer_character_asset_cache,
    upload_influencer_character_photo,
    upload_influencer_character_video,
)
from app.data.schemas.admin import (
    AdminAdultCharacterCreate,
    AdminAdultCharacterOut,
    AdminAdultCharacterUpdate,
    AdminDeleteResponse,
    AdminInfluencerAdultCharacterAssetOut,
    AdminInfluencerCharacterAssetMutationOut,
)
from app.utils.prompt_template import validate_required_template_variables
from app.utils.auth.dependencies import get_current_user
from app.utils.storage.s3 import delete_file_from_s3, generate_presigned_url, save_sample_audio_to_s3, save_character_sample_audio_to_s3

router = APIRouter(tags=["admin-characters"])
log = logging.getLogger(__name__)
ADULT_REQUIRED_PROMPT_VARIABLES = frozenset({"influencer_name", "user_name"})


async def _get_influencer_character_overlay(
    db: AsyncSession,
    influencer_id: str,
    character_id: int,
) -> InfluencerCharacterMeta | None:
    result = await db.execute(
        select(InfluencerCharacterMeta).where(
            InfluencerCharacterMeta.influencer_id == influencer_id,
            InfluencerCharacterMeta.character_id == character_id,
        )
    )
    return result.scalars().first()


async def _build_admin_influencer_adult_characters(
    db: AsyncSession,
    influencer_id: str,
) -> list[AdminInfluencerAdultCharacterAssetOut]:
    characters_result = await db.execute(
        select(AdultCharacter)
        .where(AdultCharacter.is_active.is_(True))
        .order_by(AdultCharacter.display_order, AdultCharacter.id)
    )
    characters = sorted(
        characters_result.scalars().all(),
        key=lambda character: (character.display_order, character.id),
    )

    overlay_result = await db.execute(
        select(InfluencerCharacterMeta).where(
            InfluencerCharacterMeta.influencer_id == influencer_id,
        )
    )
    overlays = {
        overlay.character_id: overlay
        for overlay in overlay_result.scalars().all()
        if overlay.is_active
    }

    items: list[AdminInfluencerAdultCharacterAssetOut] = []
    for character in characters:
        overlay = overlays.get(character.id)
        asset_state = await get_influencer_character_asset_state(influencer_id, character.id)
        items.append(
            AdminInfluencerAdultCharacterAssetOut(
                id=character.id,
                slug=character.slug,
                name=character.name,
                description=character.description,
                short_description=character.short_description,
                is_active=character.is_active,
                display_order=character.display_order,
                base_lottie_text=character.lottie_text,
                photo_url=asset_state["photo_url"],
                photo_2x_url=asset_state["photo_2x_url"],
                video_mp4_url=asset_state["video_mp4_url"],
                video_webm_url=asset_state["video_webm_url"],
                video_preview_png_url=asset_state["video_preview_png_url"],
                has_photo=asset_state["has_photo"],
                has_complete_video_set=asset_state["has_complete_video_set"],
                resolved_lottie_text=character.lottie_text,
                meta_json=overlay.meta_json if overlay else None,
                has_influencer_override=overlay is not None,
            )
        )
    return items


async def _build_admin_adult_character_out(character: AdultCharacter) -> AdminAdultCharacterOut:
    asset_state = await get_adult_character_asset_state(
        character.id,
        character.default_artwork_key,
        character.lottie_text,
    )
    payload = AdminAdultCharacterOut.model_validate(character).model_dump()
    payload.update(asset_state)
    return AdminAdultCharacterOut(**payload)


@router.get(
    "/adult-characters",
    response_model=list[AdminAdultCharacterOut],
    summary="List adult characters",
    description="Return the global adult character catalog for admin management.",
)
async def list_admin_adult_characters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    result = await db.execute(
        select(AdultCharacter).order_by(AdultCharacter.display_order, AdultCharacter.id)
    )
    characters = sorted(
        result.scalars().all(),
        key=lambda character: (character.display_order, character.id),
    )
    return [await _build_admin_adult_character_out(character) for character in characters]


@router.post(
    "/adult-characters",
    response_model=AdminAdultCharacterOut,
    status_code=201,
    summary="Create an adult character",
    description="Create a new global adult character entry in the admin catalog.",
)
async def create_admin_adult_character(
    payload: AdminAdultCharacterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        validate_required_template_variables(
            payload.prompt_template,
            ADULT_REQUIRED_PROMPT_VARIABLES,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing = await db.execute(
        select(AdultCharacter).where(AdultCharacter.slug == payload.slug)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Adult character with this slug already exists")

    character = AdultCharacter(**payload.model_dump())
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return await _build_admin_adult_character_out(character)


@router.delete(
    "/adult-characters/{character_id}",
    response_model=AdminDeleteResponse,
    summary="Delete an adult character",
    description="Delete a global adult character entry from the admin catalog.",
)
async def delete_admin_adult_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    character = await db.get(AdultCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Adult character not found")

    await db.delete(character)
    await db.commit()
    return AdminDeleteResponse(ok=True, id=character_id)


@router.patch(
    "/adult-characters/{character_id}",
    response_model=AdminAdultCharacterOut,
    summary="Update an adult character",
    description="Apply a partial update to a global adult character entry in the admin catalog.",
)
async def patch_admin_adult_character(
    character_id: int,
    payload: AdminAdultCharacterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    character = await db.get(AdultCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Adult character not found")

    update_payload = payload.model_dump(exclude_unset=True)
    next_prompt_template = update_payload.get("prompt_template")
    if next_prompt_template is not None:
        try:
            validate_required_template_variables(
                next_prompt_template,
                ADULT_REQUIRED_PROMPT_VARIABLES,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    next_slug = update_payload.get("slug")
    if next_slug and next_slug != character.slug:
        existing = await db.execute(
            select(AdultCharacter).where(AdultCharacter.slug == next_slug)
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Adult character with this slug already exists")
    if update_payload.get("is_active") is False:
        active_overlay_result = await db.execute(
            select(InfluencerCharacterMeta).where(
                InfluencerCharacterMeta.character_id == character_id,
                InfluencerCharacterMeta.is_active.is_(True),
            )
        )
        if active_overlay_result.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="Cannot disable adult character while it is active for an influencer",
            )

    for key, value in update_payload.items():
        setattr(character, key, value)

    db.add(character)
    await db.commit()
    await db.refresh(character)
    return await _build_admin_adult_character_out(character)


@router.post(
    "/adult-characters/{character_id}/assets",
    response_model=AdminAdultCharacterOut,
    summary="Upload base adult character assets",
    description="Upload default artwork and lottie assets for a global adult character.",
)
async def upsert_admin_adult_character_assets(
    character_id: int,
    default_artwork: UploadFile | None = File(default=None),
    lottie_text: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    character = await db.get(AdultCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Adult character not found")

    if not any((default_artwork, lottie_text)):
        raise HTTPException(status_code=400, detail="At least one asset file is required")

    if default_artwork:
        artwork_bytes = await default_artwork.read()
        if not artwork_bytes:
            raise HTTPException(status_code=400, detail="Empty default artwork file")
        character.default_artwork_key = await upload_adult_character_default_artwork(
            io.BytesIO(artwork_bytes),
            default_artwork.filename,
            default_artwork.content_type or "image/png",
            character_id,
        )

    if lottie_text:
        lottie_bytes = await lottie_text.read()
        if not lottie_bytes:
            raise HTTPException(status_code=400, detail="Empty lottie file")
        character.lottie_text = await upload_adult_character_lottie(
            io.BytesIO(lottie_bytes),
            character_id,
        )

    db.add(character)
    await db.commit()
    await db.refresh(character)
    await invalidate_adult_character_asset_cache(character_id)
    return await _build_admin_adult_character_out(character)


@router.get(
    "/influencer/{influencer_id}/adult-characters",
    response_model=list[AdminInfluencerAdultCharacterAssetOut],
    summary="List influencer character assets",
    description="Return admin asset state for all adult characters for a specific influencer.",
)
async def get_admin_influencer_adult_characters(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    return await _build_admin_influencer_adult_characters(db, influencer_id)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/assets",
    response_model=AdminInfluencerCharacterAssetMutationOut,
    summary="Upload influencer character assets",
    description="Upload one or more deterministic photo or video assets for an influencer character.",
)
async def upsert_admin_influencer_character_assets(
    influencer_id: str,
    character_id: int,
    photo: UploadFile | None = File(default=None),
    photo_2x: UploadFile | None = File(default=None),
    video_mp4: UploadFile | None = File(default=None),
    video_webm: UploadFile | None = File(default=None),
    video_preview_png: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")

    if not any((photo, photo_2x, video_mp4, video_webm, video_preview_png)):
        raise HTTPException(status_code=400, detail="At least one asset file is required")

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    uploaded_keys: list[str] = []

    try:
        if photo:
            photo_bytes = await photo.read()
            if not photo_bytes:
                raise HTTPException(status_code=400, detail="Empty photo file")
            uploaded_keys.append(
                await upload_influencer_character_photo(
                    io.BytesIO(photo_bytes),
                    photo.filename,
                    photo.content_type or "image/jpeg",
                    influencer_id,
                    character_id,
                    variant="photo",
                )
            )

        if photo_2x:
            photo_2x_bytes = await photo_2x.read()
            if not photo_2x_bytes:
                raise HTTPException(status_code=400, detail="Empty photo_2x file")
            uploaded_keys.append(
                await upload_influencer_character_photo(
                    io.BytesIO(photo_2x_bytes),
                    photo_2x.filename,
                    photo_2x.content_type or "image/jpeg",
                    influencer_id,
                    character_id,
                    variant="photo_2x",
                )
            )

        if video_mp4:
            video_mp4_bytes = await video_mp4.read()
            if not video_mp4_bytes:
                raise HTTPException(status_code=400, detail="Empty video_mp4 file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(video_mp4_bytes),
                    video_mp4.content_type or "video/mp4",
                    influencer_id,
                    character_id,
                    variant="video_mp4",
                )
            )

        if video_webm:
            video_webm_bytes = await video_webm.read()
            if not video_webm_bytes:
                raise HTTPException(status_code=400, detail="Empty video_webm file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(video_webm_bytes),
                    video_webm.content_type or "video/webm",
                    influencer_id,
                    character_id,
                    variant="video_webm",
                )
            )

        if video_preview_png:
            preview_bytes = await video_preview_png.read()
            if not preview_bytes:
                raise HTTPException(status_code=400, detail="Empty video_preview_png file")
            uploaded_keys.append(
                await upload_influencer_character_video(
                    io.BytesIO(preview_bytes),
                    video_preview_png.content_type or "image/png",
                    influencer_id,
                    character_id,
                    variant="video_preview_png",
                )
            )
    except HTTPException:
        for key in uploaded_keys:
            try:
                await delete_influencer_character_asset(key)
            except Exception:
                log.warning("Failed to cleanup uploaded character asset %s", key, exc_info=True)
        raise
    except Exception:
        for key in uploaded_keys:
            try:
                await delete_influencer_character_asset(key)
            except Exception:
                log.warning("Failed to cleanup uploaded character asset %s", key, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save character assets")

    await invalidate_influencer_character_asset_cache(influencer_id, character_id)
    asset_state = await get_influencer_character_asset_state(influencer_id, character_id)
    return AdminInfluencerCharacterAssetMutationOut(
        influencer_id=influencer_id,
        character_id=character_id,
        photo_url=asset_state["photo_url"],
        photo_2x_url=asset_state["photo_2x_url"],
        video_mp4_url=asset_state["video_mp4_url"],
        video_webm_url=asset_state["video_webm_url"],
        video_preview_png_url=asset_state["video_preview_png_url"],
        has_photo=asset_state["has_photo"],
        has_complete_video_set=asset_state["has_complete_video_set"],
        meta_json=overlay.meta_json if overlay else None,
        has_influencer_override=overlay is not None,
    )


@router.delete(
    "/influencer/{influencer_id}/adult-characters/{character_id}/assets/{asset_type}",
    response_model=AdminInfluencerCharacterAssetMutationOut,
    summary="Delete influencer character assets",
    description="Delete one influencer character asset or the full grouped video asset set.",
)
async def delete_admin_influencer_character_asset(
    influencer_id: str,
    character_id: int,
    asset_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    keys = get_influencer_character_asset_keys(influencer_id, character_id)
    presence = await get_influencer_character_asset_presence(influencer_id, character_id)
    try:
        target_keys = {
            "photo": [keys["photo"]],
            "photo_2x": [keys["photo_2x"]],
            "video_mp4": [keys["video_mp4"]],
            "video_webm": [keys["video_webm"]],
            "video_preview_png": [keys["video_preview_png"]],
            "video": [keys["video_mp4"], keys["video_webm"], keys["video_preview_png"]],
        }[asset_type]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="Invalid asset type") from exc
    key_to_presence = {
        keys["photo"]: presence["photo"],
        keys["photo_2x"]: presence["photo_2x"],
        keys["video_mp4"]: presence["video_mp4"],
        keys["video_webm"]: presence["video_webm"],
        keys["video_preview_png"]: presence["video_preview_png"],
    }
    existing_keys = [key for key in target_keys if key_to_presence[key]]
    if not existing_keys:
        raise HTTPException(status_code=404, detail=f"{asset_type} asset not found")

    for key in existing_keys:
        try:
            await delete_influencer_character_asset(key)
        except Exception:
            log.warning("Failed to delete character asset file %s", key, exc_info=True)

    await invalidate_influencer_character_asset_cache(influencer_id, character_id)
    asset_state = await get_influencer_character_asset_state(influencer_id, character_id)
    return AdminInfluencerCharacterAssetMutationOut(
        influencer_id=influencer_id,
        character_id=character_id,
        photo_url=asset_state["photo_url"],
        photo_2x_url=asset_state["photo_2x_url"],
        video_mp4_url=asset_state["video_mp4_url"],
        video_webm_url=asset_state["video_webm_url"],
        video_preview_png_url=asset_state["video_preview_png_url"],
        has_photo=asset_state["has_photo"],
        has_complete_video_set=asset_state["has_complete_video_set"],
        meta_json=overlay.meta_json if overlay else None,
        has_influencer_override=overlay is not None,
    )


@router.post(
    "/influencer/{influencer_id}/samples",
    summary="Upload influencer sample audio",
    description="Upload a new sample audio file for an influencer and append it to the stored sample list.",
)
async def upload_influencer_sample(
    influencer_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    s3_key = await save_sample_audio_to_s3(
        io.BytesIO(file_bytes),
        file.filename or "sample.mp3",
        file.content_type or "audio/mpeg",
        influencer_id,
    )

    sample_entry = {
        "s3_key": s3_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if influencer.samples is None:
        influencer.samples = [sample_entry]
    else:
        influencer.samples = influencer.samples + [sample_entry]

    await db.commit()
    await db.refresh(influencer)

    return {
        "id": s3_key,
        "s3_key": s3_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "url": generate_presigned_url(s3_key),
        "created_at": sample_entry["created_at"],
    }


@router.delete(
    "/influencer/{influencer_id}/samples/{sample_id}",
    summary="Delete influencer sample audio",
    description="Delete one stored influencer sample audio entry and its S3 object.",
)
async def delete_influencer_sample(
    influencer_id: str,
    sample_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    if not influencer.samples:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample = next((s for s in influencer.samples if s.get("s3_key") == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    influencer.samples = [s for s in influencer.samples if s.get("s3_key") != sample_id]

    try:
        await delete_file_from_s3(sample_id)
    except Exception:
        log.warning("Failed to delete S3 sample file %s", sample_id, exc_info=True)

    await db.commit()
    return {"ok": True, "deleted_id": sample_id}


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/samples",
    summary="Upload character scene sample audio",
    description="Upload a normal or explicit audio sample for a specific influencer + scene (adult character) combo.",
)
async def upload_character_scene_sample(
    influencer_id: str,
    character_id: int,
    file: UploadFile = File(...),
    sample_type: str = "normal",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    if sample_type not in ("normal", "explicit"):
        raise HTTPException(status_code=400, detail="sample_type must be 'normal' or 'explicit'")

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Character not found")

    allowed_audio_types = {"audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"}
    if file.content_type not in allowed_audio_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: mp3, mp4, wav, webm, ogg")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    s3_key = await save_character_sample_audio_to_s3(
        io.BytesIO(file_bytes),
        file.filename or "sample.mp3",
        file.content_type or "audio/mpeg",
        influencer_id,
        character_id,
        sample_type,
    )

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    if not overlay:
        overlay = InfluencerCharacterMeta(
            influencer_id=influencer_id,
            character_id=character_id,
            meta_json={},
        )
        db.add(overlay)

    sample_entry = {
        "s3_key": s3_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    meta = dict(overlay.meta_json or {})
    samples = dict(meta.get("samples", {}))
    existing = list(samples.get(sample_type, []))
    existing.append(sample_entry)
    samples[sample_type] = existing
    meta["samples"] = samples
    overlay.meta_json = meta

    try:
        await db.commit()
    except Exception:
        try:
            await delete_file_from_s3(s3_key)
        except Exception:
            log.warning("Failed to cleanup S3 after DB error for key %s", s3_key, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save sample")

    return {
        "s3_key": s3_key,
        "sample_type": sample_type,
        "url": generate_presigned_url(s3_key),
        "original_filename": file.filename,
        "created_at": sample_entry["created_at"],
    }


@router.delete(
    "/influencer/{influencer_id}/adult-characters/{character_id}/samples/{sample_type}/{sample_id:path}",
    summary="Delete character scene sample audio",
    description="Delete a normal or explicit audio sample for a specific influencer + scene combo.",
)
async def delete_character_scene_sample(
    influencer_id: str,
    character_id: int,
    sample_type: str,
    sample_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    if sample_type not in ("normal", "explicit"):
        raise HTTPException(status_code=400, detail="sample_type must be 'normal' or 'explicit'")

    overlay = await _get_influencer_character_overlay(db, influencer_id, character_id)
    if not overlay or not overlay.meta_json:
        raise HTTPException(status_code=404, detail="No samples found")

    samples = dict(overlay.meta_json.get("samples", {}))
    current = samples.get(sample_type, [])
    updated = [s for s in current if s.get("s3_key") != sample_id]

    if len(updated) == len(current):
        raise HTTPException(status_code=404, detail="Sample not found")

    samples[sample_type] = updated
    meta = dict(overlay.meta_json)
    meta["samples"] = samples
    overlay.meta_json = meta

    try:
        await delete_file_from_s3(sample_id)
    except Exception:
        log.warning("Failed to delete S3 character sample %s", sample_id, exc_info=True)

    await db.commit()
    return {"ok": True, "deleted_id": sample_id}
