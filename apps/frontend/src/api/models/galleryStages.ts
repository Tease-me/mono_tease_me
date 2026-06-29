export interface GalleryStageConfig {
  stage_index: number;
  title: string;
  description: string;
  scene_description: string;
  tags: string[];
  video_prompt: string;
}

export interface GalleryStagesConfigResponse {
  influencer_id: string;
  character_id: number;
  character_slug: string;
  source: string;
  stages: GalleryStageConfig[];
  default_stages: GalleryStageConfig[];
}

export interface GalleryStagesConfigPayload {
  stages: GalleryStageConfig[];
}

export function buildStageVideoPrompt(stage: GalleryStageConfig): string {
  const videoPrompt = stage.video_prompt.trim();
  if (videoPrompt) {
    return videoPrompt;
  }
  return (
    `Create a natural looping video variation for stage ${stage.stage_index}. ` +
    "Subtle idle motion that repeats seamlessly."
  );
}
