export interface CharacterGalleryVariant {
  variant_index: number;
  scene_description: string | null;
  tags: string[];
  video_mp4_url: string | null;
  video_webm_url: string | null;
  poster_url: string | null;
  has_mp4: boolean;
  has_webm: boolean;
  has_poster: boolean;
}

export interface CharacterGalleryCandidate {
  id: number;
  stage_index: number;
  status: string;
  generation_prompt: string;
  assigned_variant_index: number | null;
  error_message: string | null;
  preview_url: string | null;
  video_url: string | null;
  has_video: boolean;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface CharacterGalleryStage {
  stage_index: number;
  title: string | null;
  description: string | null;
  stage_context: string | null;
  source_photo_url: string | null;
  source_photo_is_default: boolean;
  variants: CharacterGalleryVariant[];
  candidates: CharacterGalleryCandidate[];
}

export interface CharacterGalleryResponse {
  influencer_id: string;
  character_id: number;
  stages: CharacterGalleryStage[];
}

export type GalleryAssetType = "mp4" | "webm" | "poster";

export interface CharacterGalleryUpsertPayload {
  title?: string;
  description?: string;
  stage_context?: string;
  scene_description?: string;
}

export interface CharacterGalleryGeneratePayload {
  prompt?: string;
  variation_count?: number;
}

export interface CharacterGalleryApprovePayload {
  variant_index: number;
  scene_description?: string;
}

export interface CharacterGalleryReembedResponse {
  influencer_id: string;
  character_id: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
}
