export interface UserGalleryStage {
  stage_index: number;
  variant_index: number;
  title: string | null;
  description: string | null;
  video_mp4_url: string | null;
  video_webm_url: string | null;
  poster_url: string | null;
  unlocked_at: string;
}

export interface UserGalleryScenario {
  character_id: number;
  slug: string;
  name: string;
  display_order: number;
  poster_url: string | null;
  stages: UserGalleryStage[];
}

export interface UserGalleryResponse {
  influencer_id: string;
  scenarios: UserGalleryScenario[];
}
