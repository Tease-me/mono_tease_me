from pydantic import BaseModel, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone


class InfluencerBase(BaseModel):
    display_name: str
    voice_id: Optional[str] = None
    prompt_template: Optional[str] = None
    daily_scripts: Optional[List[str]] = None
    bio_json: Optional[Dict[str, Any]] = None

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
    id: str


class InfluencerUpdate(BaseModel):
    display_name: Optional[str] = None
    voice_id: Optional[str] = None
    prompt_template: Optional[str] = None
    daily_scripts: Optional[List[str]] = None
    bio_json: Optional[Dict[str, Any]] = None
    influencer_agent_id_third_part: Optional[str] = None
    native_language: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    custom_adult_prompt: Optional[str] = None


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
    custom_adult_prompt: Optional[str] = None


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
    prompt_template: str
    is_active: bool
    display_order: int
    default_artwork_key: Optional[str] = None
    lottie_text: Optional[str] = None
    photo_url: Optional[str] = None
    photo_2x_url: Optional[str] = None
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    video_preview_png_url: Optional[str] = None
    has_photo: bool = False
    has_complete_video_set: bool = False
    meta_json: Optional[Dict[str, Any]] = None
    has_influencer_override: bool


class AdminInfluencerAdultCharacterAssetOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
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
