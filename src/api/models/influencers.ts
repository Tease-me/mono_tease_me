export interface InfluencerResponse {
  display_name: string;
  voice_id: string;
  prompt_template: string;
  daily_scripts: string[];
  id: string;
  influencer_agent_id_third_part: string;
  bio_json: string;
  fp_ref_id: string;
  photo_url: string;
  video_url: string;
  created_at: string;
}

export interface InfluencerSampleResponse {
  id: number;
  s3_key: string;
  original_filename?: string | null;
  content_type?: string | null;
  url?: string | null;
  created_at?: string | null;
}

export interface InfluencerSampleListResponse {
  influencer_id: string;
  count: number;
  samples: Array<{
    id: string;
    s3_key?: string | null;
    original_filename?: string | null;
    content_type?: string | null;
    url?: string | null;
    created_at?: string | null;
  }>;
}

export interface InfluencerLandingAssetsResponse {
  influencer_id: string;
  hero_png_url: string | null;
  hero_png_2x_url: string | null;
  signature_png_url: string | null;
  signature_png_2x_url: string | null;
  background_video_1_mp4_url: string | null;
  background_video_1_mp4_content_type: string | null;
  background_video_1_webm_url: string | null;
  background_video_1_webm_content_type: string | null;
  background_video_1_poster_jpg_url: string | null;
  background_video_2_mp4_url: string | null;
  background_video_2_mp4_content_type: string | null;
  background_video_2_webm_url: string | null;
  background_video_2_webm_content_type: string | null;
  background_video_2_poster_jpg_url: string | null;
  background_image_1_url: string | null;
  background_image_1_2x_url: string | null;
  background_image_2_url: string | null;
  background_image_2_2x_url: string | null;
  background_image_3_url: string | null;
  background_image_3_2x_url: string | null;
  has_hero: boolean;
  has_signature: boolean;
  has_background_videos: boolean;
  has_complete_background_images: boolean;
  updated_at: string | null;
}

export interface InfluencerBioSocialLink {
  platform: string;
  url: string;
}

export interface InfluencerBioResponse {
  id: string;
  display_name: string;
  about_me: string | null;
  country: string | null;
  languages: string[];
  likes: string[];
  dislikes: string[];
  social_links: InfluencerBioSocialLink[];
}

export interface PersonaImportResponse {
  total_rows: number;
  imported_count: number;
  prompts: PersonaImportPrompt[];
}

interface PersonaImportPrompt {
  influencer_id: string;
  name: string;
  system_prompt: string;
  raw_persona: RawPersonaImport;
}

interface LoveLanguagePreferences {
  quality_time: string | null;
  words_of_affirmation: string | null;
  acts_of_service: string | null;
  gifts: string | null;
  shared_adventure: string | null;
  physical_touch_textual: string | null;
}

interface RawPersonaTrigger {
  phrase: string;
  routine: string;
}

interface RawPersonaImport {
  influencer_id: string;
  age: number;
  occupation: string;
  name: string;
  nickname: string;
  short_bio: string;
  brand_tagline: string;
  role: string;
  traits: {
    nurturing: string | number;
    thoughtful: string | number;
    protective: string | number;
    empathetic: string | number;
    sensitive: string | number;
    independent: string | number;
    confident: string | number;
    direct: string | number;
    playful: string | number;
  };
  humor_style: string;
  intensity: number;
  emoji_level: string;
  pet_names: string;
  sentence_length: string;
  love_languages: LoveLanguagePreferences;
  conflict_style: string;
  jealousy_strategy: string;
  deal_breakers: string[];
  hard_boundaries: string[];
  catchphrases: string[];
  hobbies: string[];
  romantic_vibe: string;
  memory_seeds: string[];
  content_vibe: string[];
  preferred_ctas: string[];
  peak_times: string[];
  triggers: RawPersonaTrigger[];
}
