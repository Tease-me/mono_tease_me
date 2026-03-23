import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.db.models import Influencer, User
from app.db.session import get_db
from app.schemas.admin import (
    AdminInfluencerLandingAssetsOut,
    AdminInfluencerTelegramWelcomeAudioOut,
)
from app.use_cases.admin_influencer_assets import (
    build_admin_landing_assets_out,
    get_admin_telegram_welcome_audio_out,
    upsert_admin_landing_assets,
    upsert_admin_telegram_welcome_audio,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-influencer-assets"])
log = logging.getLogger(__name__)


async def _get_influencer_or_404(db: AsyncSession, influencer_id: str) -> Influencer:
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    return influencer


@router.get(
    "/influencer/{influencer_id}/landing-assets",
    response_model=AdminInfluencerLandingAssetsOut,
    summary="Get influencer landing assets",
)
async def get_influencer_landing_assets(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await _get_influencer_or_404(db, influencer_id)
    return await build_admin_landing_assets_out(influencer)


@router.post(
    "/influencer/{influencer_id}/landing-assets",
    response_model=AdminInfluencerLandingAssetsOut,
    summary="Upload influencer landing assets",
    description="Upload one or more landing page assets for an influencer.",
)
async def post_influencer_landing_assets(
    influencer_id: str,
    hero_png: UploadFile | None = File(default=None),
    background_video_1: UploadFile | None = File(default=None),
    background_video_2: UploadFile | None = File(default=None),
    background_image_1: UploadFile | None = File(default=None),
    background_image_1_2x: UploadFile | None = File(default=None),
    background_image_2: UploadFile | None = File(default=None),
    background_image_2_2x: UploadFile | None = File(default=None),
    background_image_3: UploadFile | None = File(default=None),
    background_image_3_2x: UploadFile | None = File(default=None),
    signature_png: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await _get_influencer_or_404(db, influencer_id)
    return await upsert_admin_landing_assets(
        db=db,
        influencer=influencer,
        files_by_slot={
            "hero_png": hero_png,
            "background_video_1": background_video_1,
            "background_video_2": background_video_2,
            "background_image_1": background_image_1,
            "background_image_1_2x": background_image_1_2x,
            "background_image_2": background_image_2,
            "background_image_2_2x": background_image_2_2x,
            "background_image_3": background_image_3,
            "background_image_3_2x": background_image_3_2x,
            "signature_png": signature_png,
        },
    )


@router.get(
    "/influencer/{influencer_id}/telegram-welcome-audio",
    response_model=AdminInfluencerTelegramWelcomeAudioOut,
    summary="Get telegram welcome audio",
)
async def get_telegram_welcome_audio(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await _get_influencer_or_404(db, influencer_id)
    return await get_admin_telegram_welcome_audio_out(influencer)


@router.post(
    "/influencer/{influencer_id}/telegram-welcome-audio",
    response_model=AdminInfluencerTelegramWelcomeAudioOut,
    summary="Upload telegram welcome audio",
)
async def post_telegram_welcome_audio(
    influencer_id: str,
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    influencer = await _get_influencer_or_404(db, influencer_id)
    return await upsert_admin_telegram_welcome_audio(
        db=db,
        influencer=influencer,
        audio=audio,
    )
