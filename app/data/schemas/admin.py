from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class AdminInfluencerAdultCharacterAssetOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    is_active: bool
    display_order: int
    base_lottie_text: Optional[str] = None
    photo_url: Optional[str] = None
    photo_2x_url: Optional[str] = None
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    video_preview_png_url: Optional[str] = None
    has_photo: bool = False
    has_complete_video_set: bool = False
    resolved_lottie_text: Optional[str] = None
    meta_json: Optional[Dict[str, Any]] = None
    has_influencer_override: bool


class AdminInfluencerCharacterAssetMutationOut(BaseModel):
    influencer_id: str
    character_id: int
    photo_url: Optional[str] = None
    photo_2x_url: Optional[str] = None
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    video_preview_png_url: Optional[str] = None
    has_photo: bool = False
    has_complete_video_set: bool = False
    meta_json: Optional[Dict[str, Any]] = None
    has_influencer_override: bool


class AdminInfluencerTelegramWelcomeMediaAssetsOut(BaseModel):
    influencer_id: str
    telegram_audio_key: Optional[str] = None
    telegram_audio_url: Optional[str] = None
    telegram_audio_content_type: Optional[str] = None
    telegram_video_key: Optional[str] = None
    telegram_video_url: Optional[str] = None
    telegram_video_content_type: Optional[str] = None
    has_audio: bool = False
    has_video: bool = False
    updated_at: Optional[str] = None


class AdminInfluencerLandingAssetsOut(BaseModel):
    influencer_id: str
    hero_png_key: Optional[str] = None
    hero_png_url: Optional[str] = None
    hero_png_2x_key: Optional[str] = None
    hero_png_2x_url: Optional[str] = None
    signature_png_key: Optional[str] = None
    signature_png_url: Optional[str] = None
    signature_png_2x_key: Optional[str] = None
    signature_png_2x_url: Optional[str] = None
    background_video_1_mp4_key: Optional[str] = None
    background_video_1_mp4_url: Optional[str] = None
    background_video_1_mp4_content_type: Optional[str] = None
    background_video_1_webm_key: Optional[str] = None
    background_video_1_webm_url: Optional[str] = None
    background_video_1_webm_content_type: Optional[str] = None
    background_video_1_poster_jpg_key: Optional[str] = None
    background_video_1_poster_jpg_url: Optional[str] = None
    background_video_2_mp4_key: Optional[str] = None
    background_video_2_mp4_url: Optional[str] = None
    background_video_2_mp4_content_type: Optional[str] = None
    background_video_2_webm_key: Optional[str] = None
    background_video_2_webm_url: Optional[str] = None
    background_video_2_webm_content_type: Optional[str] = None
    background_video_2_poster_jpg_key: Optional[str] = None
    background_video_2_poster_jpg_url: Optional[str] = None
    background_image_1_key: Optional[str] = None
    background_image_1_url: Optional[str] = None
    background_image_1_2x_key: Optional[str] = None
    background_image_1_2x_url: Optional[str] = None
    background_image_2_key: Optional[str] = None
    background_image_2_url: Optional[str] = None
    background_image_2_2x_key: Optional[str] = None
    background_image_2_2x_url: Optional[str] = None
    background_image_3_key: Optional[str] = None
    background_image_3_url: Optional[str] = None
    background_image_3_2x_key: Optional[str] = None
    background_image_3_2x_url: Optional[str] = None
    has_hero: bool = False
    has_signature: bool = False
    has_background_videos: bool = False
    has_complete_background_images: bool = False
    updated_at: Optional[str] = None


class AdminAdultCharacterCreate(BaseModel):
    slug: str
    name: str
    prompt_template: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    first_messages: Optional[list[str]] = None
    voice_price_millicents: int = 3000
    default_artwork_key: Optional[str] = None
    lottie_text: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class AdminAdultCharacterUpdate(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = None
    prompt_template: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    first_messages: Optional[list[str]] = None
    voice_price_millicents: Optional[int] = None
    default_artwork_key: Optional[str] = None
    lottie_text: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class AdminAdultCharacterOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    first_messages: Optional[list[str]] = None
    voice_price_millicents: int
    prompt_template: str
    default_artwork_key: Optional[str] = None
    default_artwork_url: Optional[str] = None
    lottie_text: Optional[str] = None
    lottie_text_url: Optional[str] = None
    is_active: bool
    display_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminDeleteResponse(BaseModel):
    ok: bool
    id: int
