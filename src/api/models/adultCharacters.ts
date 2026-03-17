export interface AdultCharacterResponse {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  prompt_template: string | null;
  is_active: boolean;
  display_order: number;
  default_artwork_key: string | null;
  default_artwork_url: string | null;
  lottie_text: string | null;
  lottie_text_url: string | null;
  photo_url: string | null;
  photo_2x_url: string | null;
  video_mp4_url: string | null;
  video_webm_url: string | null;
  video_preview_png_url: string | null;
  has_photo: boolean;
  has_complete_video_set: boolean;
  meta_json: Record<string, unknown> | null;
  has_influencer_override: boolean;
}

export type AdultCharactersResponse = AdultCharacterResponse[];
