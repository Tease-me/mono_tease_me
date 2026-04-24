from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.data.enums import InfluencerPublicationStatus


class InfluencerBase(BaseModel):
    display_name: str
    voice_id: Optional[str] = None
    prompt_template: Optional[str] = None
    bio_json: Optional[Dict[str, Any]] = None
    publication_status: InfluencerPublicationStatus = InfluencerPublicationStatus.DRAFT

    influencer_agent_id_third_part: Optional[str] = None
    created_at: Optional[datetime] = None
    native_language: Optional[str] = None
    date_of_birth: Optional[datetime] = None

    @field_validator("created_at")
    @classmethod
    def convert_to_naive_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None or value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)


class InfluencerCreate(InfluencerBase):
    model_config = ConfigDict(extra="forbid")
    id: str


class InfluencerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: Optional[str] = None
    voice_id: Optional[str] = None
    prompt_template: Optional[str] = None
    bio_json: Optional[Dict[str, Any]] = None
    publication_status: Optional[InfluencerPublicationStatus] = None
    influencer_agent_id_third_part: Optional[str] = None
    native_language: Optional[str] = None
    date_of_birth: Optional[datetime] = None


class InfluencerOut(InfluencerBase):
    id: str
    profile_photo_key: Optional[str] = None
    profile_video_key: Optional[str] = None
    fp_ref_id: Optional[str] = None
    class Config:
        from_attributes = True


class InfluencerDetail(InfluencerOut):
    about: Optional[str] = None
    photo_url: Optional[str] = None
    video_url: Optional[str] = None


class SocialLink(BaseModel):
    platform: str
    url: str


class InfluencerBio(BaseModel):
    id: str
    display_name: str
    about_me: Optional[str] = None
    country: Optional[str] = None
    languages: List[str] = []
    likes: List[str] = []
    dislikes: List[str] = []
    social_links: List[SocialLink] = []


class InfluencerAdultCharacterOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    first_messages: Optional[List[str]] = None
    prompt_template: str
    is_active: bool
    display_order: int
    default_artwork_key: Optional[str] = None
    default_artwork_url: Optional[str] = None
    lottie_text: Optional[str] = None
    lottie_text_url: Optional[str] = None
    photo_url: Optional[str] = None
    photo_2x_url: Optional[str] = None
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    video_preview_png_url: Optional[str] = None
    has_photo: bool = False
    has_complete_video_set: bool = False
    meta_json: Optional[Dict[str, Any]] = None
    has_influencer_override: bool


class InfluencerTelegramWelcomeMediaOut(BaseModel):
    influencer_id: str
    telegram_audio_url: Optional[str] = None
    telegram_audio_content_type: Optional[str] = None
    telegram_video_url: Optional[str] = None
    telegram_video_content_type: Optional[str] = None
    has_audio: bool = False
    has_video: bool = False
    updated_at: Optional[str] = None


class InfluencerLandingAssetsOut(BaseModel):
    influencer_id: str
    hero_png_url: Optional[str] = None
    hero_png_2x_url: Optional[str] = None
    signature_png_url: Optional[str] = None
    signature_png_2x_url: Optional[str] = None
    background_video_1_mp4_url: Optional[str] = None
    background_video_1_mp4_content_type: Optional[str] = None
    background_video_1_webm_url: Optional[str] = None
    background_video_1_webm_content_type: Optional[str] = None
    background_video_1_poster_jpg_url: Optional[str] = None
    background_video_2_mp4_url: Optional[str] = None
    background_video_2_mp4_content_type: Optional[str] = None
    background_video_2_webm_url: Optional[str] = None
    background_video_2_webm_content_type: Optional[str] = None
    background_video_2_poster_jpg_url: Optional[str] = None
    background_image_1_url: Optional[str] = None
    background_image_1_2x_url: Optional[str] = None
    background_image_2_url: Optional[str] = None
    background_image_2_2x_url: Optional[str] = None
    background_image_3_url: Optional[str] = None
    background_image_3_2x_url: Optional[str] = None
    has_hero: bool = False
    has_signature: bool = False
    has_background_videos: bool = False
    has_complete_background_images: bool = False
    updated_at: Optional[str] = None
