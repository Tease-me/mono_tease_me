from typing import Optional

from pydantic import BaseModel


class CharacterGalleryVariantOut(BaseModel):
    variant_index: int
    scene_description: Optional[str] = None
    tags: list[str] = []
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    poster_url: Optional[str] = None
    has_mp4: bool = False
    has_webm: bool = False
    has_poster: bool = False


class CharacterGalleryCandidateOut(BaseModel):
    id: int
    stage_index: int
    status: str
    generation_prompt: str
    assigned_variant_index: Optional[int] = None
    error_message: Optional[str] = None
    preview_url: Optional[str] = None
    video_url: Optional[str] = None
    has_video: bool = False
    created_at: Optional[str] = None
    reviewed_at: Optional[str] = None


class CharacterGalleryStageOut(BaseModel):
    stage_index: int
    title: Optional[str] = None
    description: Optional[str] = None
    stage_context: Optional[str] = None
    source_photo_url: Optional[str] = None
    source_photo_is_default: bool = False
    variants: list[CharacterGalleryVariantOut]
    candidates: list[CharacterGalleryCandidateOut] = []


class CharacterGalleryOut(BaseModel):
    influencer_id: str
    character_id: int
    stages: list[CharacterGalleryStageOut]


class CharacterGalleryVariantUpsertRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    stage_context: Optional[str] = None
    scene_description: Optional[str] = None
    tags: Optional[list[str]] = None


class CharacterGalleryGenerateRequest(BaseModel):
    prompt: Optional[str] = None
    variation_count: int = 2


class CharacterGalleryApproveRequest(BaseModel):
    variant_index: int
    scene_description: Optional[str] = None


class CharacterGalleryVariantUpsertOut(BaseModel):
    influencer_id: str
    character_id: int
    stage_index: int
    variant_index: int
    title: Optional[str] = None
    description: Optional[str] = None
    stage_context: Optional[str] = None
    scene_description: Optional[str] = None
    tags: list[str] = []
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    poster_url: Optional[str] = None
    has_mp4: bool = False
    has_webm: bool = False
    has_poster: bool = False


class CharacterGalleryAssetUploadOut(BaseModel):
    influencer_id: str
    character_id: int
    stage_index: int
    variant_index: int
    asset_type: str
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    poster_url: Optional[str] = None
    has_mp4: bool = False
    has_webm: bool = False
    has_poster: bool = False


class CharacterGalleryReembedOut(BaseModel):
    influencer_id: str
    character_id: int
    updated: int
    skipped: int
    failed: int
    total: int
