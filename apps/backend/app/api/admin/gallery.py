import io
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.core.session import get_db
from app.data.models import AdultCharacter, CharacterStageVideoCandidate, Influencer, User
from app.data.schemas.character_gallery import (
    CharacterGalleryApproveRequest,
    CharacterGalleryAssetUploadOut,
    CharacterGalleryOut,
    CharacterGalleryReembedOut,
    CharacterGalleryVariantUpsertOut,
    CharacterGalleryVariantUpsertRequest,
)
from app.data.schemas.gallery_stages import (
    GalleryStagesConfigIn,
    GalleryStagesConfigOut,
)
from app.services.gateways.xai_imagine_gateway import XaiImagineError
from app.services.use_cases.adult.gallery_generation import (
    approve_candidate,
    clear_stage_gallery,
    generate_looping_video_from_face,
    generate_stage_variations,
    merge_face_with_default_outfit,
    reject_candidate,
    upload_stage_source_photo,
)
from app.services.repositories.character_stage_video_repository import (
    ASSET_VARIANTS,
    STAGE_COUNT,
    VARIANT_COUNT,
    delete_stage_variant,
    get_gallery_state,
    reembed_scene_descriptions,
    set_stage_variant_asset_key,
    upload_stage_video_asset,
    upsert_stage_variant,
    variant_row_urls,
)
from app.services.repositories.gallery_stages_repository import (
    build_generation_prompt,
    get_character_default_stages_config,
    get_gallery_stages_config,
    get_stage_from_config,
    save_gallery_stages_config,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["Admin Gallery"])
log = logging.getLogger(__name__)


def _validate_stage_index(stage_index: int) -> None:
    if stage_index < 1 or stage_index > STAGE_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"stage_index must be between 1 and {STAGE_COUNT}",
        )


def _validate_variant_index(variant_index: int) -> None:
    if variant_index < 1 or variant_index > VARIANT_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"variant_index must be between 1 and {VARIANT_COUNT}",
        )


async def _ensure_influencer_character(
    db: AsyncSession,
    influencer_id: str,
    character_id: int,
) -> tuple[Influencer, AdultCharacter]:
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    character = await db.get(AdultCharacter, character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")
    return influencer, character


async def _character_gallery_state(
    db: AsyncSession,
    influencer_id: str,
    character_id: int,
) -> dict:
    character = await db.get(AdultCharacter, character_id)
    return await get_gallery_state(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        default_artwork_key=character.default_artwork_key if character else None,
    )


async def _ensure_influencer(db: AsyncSession, influencer_id: str) -> Influencer:
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    return influencer


@router.get(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages-config",
    response_model=GalleryStagesConfigOut,
    summary="Get per-character gallery stages config",
)
async def get_character_gallery_stages_config(
    influencer_id: str,
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)
    config = await get_gallery_stages_config(
        influencer_id, character_id, character.slug
    )
    defaults = get_character_default_stages_config(character.slug)
    return GalleryStagesConfigOut(
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character.slug,
        source=config.get("source", "character_default"),
        stages=config["stages"],
        default_stages=defaults["stages"],
    )


@router.put(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages-config",
    response_model=GalleryStagesConfigOut,
    summary="Save per-character gallery stages config override",
)
async def save_character_gallery_stages_config(
    influencer_id: str,
    character_id: int,
    payload: GalleryStagesConfigIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)
    try:
        saved = await save_gallery_stages_config(
            influencer_id,
            character_id,
            character.slug,
            payload.model_dump(),
        )
    except Exception as exc:
        log.exception("gallery stages config save failed")
        raise HTTPException(status_code=500, detail="Failed to save stages config") from exc
    defaults = get_character_default_stages_config(character.slug)
    return GalleryStagesConfigOut(
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character.slug,
        source=saved.get("source", "override"),
        stages=saved["stages"],
        default_stages=defaults["stages"],
    )


@router.get(
    "/influencer/{influencer_id}/gallery/stages-config",
    response_model=GalleryStagesConfigOut,
    summary="Deprecated: use per-character stages-config endpoint",
    deprecated=True,
)
async def get_gallery_stages_config_legacy(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    await _ensure_influencer(db, influencer_id)
    defaults = get_character_default_stages_config("default")
    return GalleryStagesConfigOut(
        influencer_id=influencer_id,
        character_id=0,
        character_slug="default",
        source="character_default",
        stages=defaults["stages"],
        default_stages=defaults["stages"],
    )


@router.put(
    "/influencer/{influencer_id}/gallery/stages-config",
    response_model=GalleryStagesConfigOut,
    summary="Deprecated: use per-character stages-config endpoint",
    deprecated=True,
)
async def save_gallery_stages_config_legacy(
    influencer_id: str,
    payload: GalleryStagesConfigIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    await _ensure_influencer(db, influencer_id)
    defaults = get_character_default_stages_config("default")
    return GalleryStagesConfigOut(
        influencer_id=influencer_id,
        character_id=0,
        character_slug="default",
        source="character_default",
        stages=payload.stages,
        default_stages=defaults["stages"],
    )


@router.get(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery",
    response_model=CharacterGalleryOut,
    summary="Get scenario gallery for a character",
)
async def get_character_gallery(
    influencer_id: str,
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    await _ensure_influencer_character(db, influencer_id, character_id)
    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.put(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/variants/{variant_index}",
    response_model=CharacterGalleryVariantUpsertOut,
    summary="Upsert gallery variant metadata",
)
async def upsert_character_gallery_variant(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    payload: CharacterGalleryVariantUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _validate_variant_index(variant_index)
    await _ensure_influencer_character(db, influencer_id, character_id)

    try:
        row = await upsert_stage_variant(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            variant_index=variant_index,
            title=payload.title,
            description=payload.description,
            stage_context=payload.stage_context,
            scene_description=payload.scene_description,
            tags=payload.tags,
        )
    except Exception as exc:
        log.exception("gallery upsert failed")
        raise HTTPException(status_code=500, detail="Failed to save gallery metadata") from exc

    urls = await variant_row_urls(row)

    return CharacterGalleryVariantUpsertOut(
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
        title=row.title,
        description=row.description,
        stage_context=row.stage_context,
        scene_description=row.scene_description,
        tags=row.tags or [],
        **urls,
    )


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/variants/{variant_index}/assets/{asset_type}",
    response_model=CharacterGalleryAssetUploadOut,
    summary="Upload gallery stage video asset",
)
async def upload_character_gallery_asset(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    asset_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _validate_variant_index(variant_index)
    if asset_type not in ASSET_VARIANTS:
        raise HTTPException(status_code=400, detail="asset_type must be mp4, webm, or poster")

    await _ensure_influencer_character(db, influencer_id, character_id)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    content_types = {
        "mp4": {"video/mp4", "video/*"},
        "webm": {"video/webm", "video/*"},
        "poster": {"image/png", "image/jpeg", "image/*"},
    }
    ct = (file.content_type or "").split(";", 1)[0].strip().lower()
    allowed = content_types[asset_type]
    if ct not in allowed and not ct.startswith("video/") and asset_type != "poster":
        if asset_type == "mp4" and "mp4" not in (file.filename or "").lower():
            raise HTTPException(status_code=400, detail="Invalid MP4 file")
    if asset_type == "poster" and not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid poster image")

    default_ct = {"mp4": "video/mp4", "webm": "video/webm", "poster": "image/png"}[asset_type]

    try:
        s3_key = await upload_stage_video_asset(
            io.BytesIO(file_bytes),
            file.content_type or default_ct,
            influencer_id,
            character_id,
            stage_index,
            variant_index,
            asset_type=asset_type,
        )
        row = await set_stage_variant_asset_key(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
            variant_index=variant_index,
            asset_type=asset_type,
            s3_key=s3_key,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("gallery asset upload failed")
        raise HTTPException(status_code=500, detail="Failed to upload gallery asset") from exc

    urls = await variant_row_urls(row)

    return CharacterGalleryAssetUploadOut(
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
        asset_type=asset_type,
        **urls,
    )


@router.delete(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/variants/{variant_index}",
    summary="Delete gallery variant and its assets",
)
async def delete_character_gallery_variant(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    variant_index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _validate_variant_index(variant_index)
    await _ensure_influencer_character(db, influencer_id, character_id)
    await delete_stage_variant(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
    )
    return {"ok": True}


@router.delete(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/clear",
    response_model=CharacterGalleryOut,
    summary="Clear stage gallery: source photo, candidates, and approved slots",
)
async def clear_character_gallery_stage(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)

    try:
        await clear_stage_gallery(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_index=stage_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.exception("gallery clear stage failed")
        raise HTTPException(status_code=500, detail="Failed to clear stage gallery") from exc

    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/source-photo",
    summary="Upload source photo for Grok variation generation",
)
async def upload_gallery_source_photo(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    file: UploadFile = File(...),
    merge_face_with_outfit: bool = Form(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Source photo must be an image")

    try:
        if merge_face_with_outfit:
            await merge_face_with_default_outfit(
                face_image_bytes=file_bytes,
                face_content_type=file.content_type or "image/jpeg",
                influencer_id=influencer_id,
                character_id=character_id,
                stage_index=stage_index,
                default_artwork_key=character.default_artwork_key,
            )
        else:
            await upload_stage_source_photo(
                io.BytesIO(file_bytes),
                file.content_type or "image/jpeg",
                influencer_id,
                character_id,
                stage_index,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except XaiImagineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        log.exception("gallery source photo upload failed")
        raise HTTPException(status_code=500, detail="Failed to upload source photo") from exc

    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/stages/{stage_index}/generate",
    response_model=CharacterGalleryOut,
    summary="Generate looping video from face photo + default outfit",
)
async def generate_gallery_variations(
    influencer_id: str,
    character_id: int,
    stage_index: int,
    face_photo: UploadFile | None = File(default=None),
    prompt: str | None = Form(default=None),
    variation_count: int = Form(default=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_stage_index(stage_index)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)

    resolved_prompt = (prompt or "").strip()
    config = await get_gallery_stages_config(
        influencer_id, character_id, character.slug
    )
    stage = get_stage_from_config(config, stage_index)
    if not resolved_prompt:
        resolved_prompt = build_generation_prompt(stage)
    if not resolved_prompt:
        raise HTTPException(status_code=400, detail="Gallery stage has no looping video prompt")

    try:
        if face_photo is not None:
            face_bytes = await face_photo.read()
            if not face_bytes:
                raise HTTPException(status_code=400, detail="Empty face photo")
            if not (face_photo.content_type or "").startswith("image/"):
                raise HTTPException(status_code=400, detail="Face photo must be an image")
            await generate_looping_video_from_face(
                db,
                influencer_id=influencer_id,
                character_id=character_id,
                stage_index=stage_index,
                face_image_bytes=face_bytes,
                face_content_type=face_photo.content_type or "image/jpeg",
                prompt=resolved_prompt,
                stage_title=str(stage.get("title") or ""),
                stage_description=str(stage.get("description") or ""),
                variation_count=variation_count,
                default_artwork_key=character.default_artwork_key,
            )
        else:
            await generate_stage_variations(
                db,
                influencer_id=influencer_id,
                character_id=character_id,
                stage_index=stage_index,
                prompt=resolved_prompt,
                variation_count=variation_count,
                default_artwork_key=character.default_artwork_key,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except XaiImagineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("gallery generate failed")
        raise HTTPException(status_code=502, detail="Grok generation failed") from exc

    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/candidates/{candidate_id}/approve",
    response_model=CharacterGalleryOut,
    summary="Approve a Grok-generated candidate into a variant slot",
)
async def approve_gallery_candidate(
    influencer_id: str,
    character_id: int,
    candidate_id: int,
    payload: CharacterGalleryApproveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _validate_variant_index(payload.variant_index)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)

    candidate_result = await db.execute(
        select(CharacterStageVideoCandidate).where(
            CharacterStageVideoCandidate.id == candidate_id
        )
    )
    candidate_row = candidate_result.scalar_one_or_none()
    if not candidate_row:
        raise HTTPException(status_code=404, detail="Candidate not found")

    stages_config = await get_gallery_stages_config(
        influencer_id, character_id, character.slug
    )
    stage = get_stage_from_config(stages_config, candidate_row.stage_index)

    try:
        await approve_candidate(
            db,
            candidate_id=candidate_id,
            variant_index=payload.variant_index,
            title=stage.get("title"),
            description=stage.get("description"),
            stage_context=stage.get("scene_description"),
            scene_description=payload.scene_description or stage.get("scene_description"),
            tags=stage.get("tags"),
            influencer_id=influencer_id,
            character_id=character_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.exception("gallery approve failed")
        raise HTTPException(status_code=500, detail="Failed to approve candidate") from exc

    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/candidates/{candidate_id}/reject",
    response_model=CharacterGalleryOut,
    summary="Reject a Grok-generated candidate",
)
async def reject_gallery_candidate(
    influencer_id: str,
    character_id: int,
    candidate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    await _ensure_influencer_character(db, influencer_id, character_id)

    try:
        await reject_candidate(
            db,
            candidate_id=candidate_id,
            influencer_id=influencer_id,
            character_id=character_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.exception("gallery reject failed")
        raise HTTPException(status_code=500, detail="Failed to reject candidate") from exc

    state = await _character_gallery_state(db, influencer_id, character_id)
    return CharacterGalleryOut(**state)


@router.post(
    "/influencer/{influencer_id}/adult-characters/{character_id}/gallery/reembed-scene-descriptions",
    response_model=CharacterGalleryReembedOut,
    summary="Re-sync scene keywords from stage config and regenerate embeddings",
)
async def reembed_character_gallery_scene_descriptions(
    influencer_id: str,
    character_id: int,
    sync_from_config: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    _, character = await _ensure_influencer_character(db, influencer_id, character_id)

    stage_scene_descriptions: dict[int, str] | None = None
    stage_tags: dict[int, list[str]] | None = None
    if sync_from_config:
        config = await get_gallery_stages_config(
            influencer_id, character_id, character.slug
        )
        stage_scene_descriptions = {
            stage["stage_index"]: stage.get("scene_description", "")
            for stage in config.get("stages", [])
            if stage.get("scene_description")
        }
        stage_tags = {
            stage["stage_index"]: stage.get("tags", [])
            for stage in config.get("stages", [])
            if stage.get("tags")
        }

    try:
        stats = await reembed_scene_descriptions(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
            stage_scene_descriptions=stage_scene_descriptions,
            stage_tags=stage_tags,
        )
    except Exception as exc:
        log.exception("gallery reembed scene descriptions failed")
        raise HTTPException(
            status_code=500, detail="Failed to re-embed scene descriptions"
        ) from exc

    return CharacterGalleryReembedOut(
        influencer_id=influencer_id,
        character_id=character_id,
        **stats,
    )
