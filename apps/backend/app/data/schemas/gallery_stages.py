from pydantic import BaseModel, Field


class GalleryStageConfigOut(BaseModel):
    stage_index: int
    title: str
    description: str = ""
    scene_description: str = ""
    tags: list[str] = []
    video_prompt: str = ""


class GalleryStagesConfigOut(BaseModel):
    influencer_id: str
    character_id: int
    character_slug: str
    source: str = "character_default"
    stages: list[GalleryStageConfigOut]
    default_stages: list[GalleryStageConfigOut] = []


class GalleryStageConfigIn(BaseModel):
    stage_index: int = Field(ge=1, le=5)
    title: str = ""
    description: str = ""
    scene_description: str = ""
    tags: list[str] = []
    video_prompt: str = ""


class GalleryStagesConfigIn(BaseModel):
    stages: list[GalleryStageConfigIn]
