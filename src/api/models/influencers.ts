export interface InfluencerResponse {
  display_name: string;
  voice_id: string;
  prompt_template: string;
  daily_scripts: string[];
  id: string;
  influencer_agent_id_third_part: string;
  bio_json: string;
  fp_ref_id: string;
  created_at: string;
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
