from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserGalleryStageOut(BaseModel):
    stage_index: int
    variant_index: int
    title: Optional[str] = None
    description: Optional[str] = None
    video_mp4_url: Optional[str] = None
    video_webm_url: Optional[str] = None
    poster_url: Optional[str] = None
    unlocked_at: datetime


class UserGalleryScenarioOut(BaseModel):
    character_id: int
    slug: str
    name: str
    display_order: int
    poster_url: Optional[str] = None
    stages: list[UserGalleryStageOut]


class UserGalleryOut(BaseModel):
    influencer_id: str
    scenarios: list[UserGalleryScenarioOut]
