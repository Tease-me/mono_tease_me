from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


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


class AdminAdultCharacterCreate(BaseModel):
    slug: str
    name: str
    prompt_template: str
    description: Optional[str] = None
    default_artwork_key: Optional[str] = None
    lottie_text: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class AdminAdultCharacterOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    prompt_template: str
    default_artwork_key: Optional[str] = None
    lottie_text: Optional[str] = None
    is_active: bool
    display_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminDeleteResponse(BaseModel):
    ok: bool
    id: int
