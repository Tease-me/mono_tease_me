export interface UserDetailResponse {
  id: number;
  full_name?: string;
  username?: string;
  email: string;
  is_varified: boolean;
  profile_photo_url?: string;
}

export type UsageMessages = {
  remaining: number;
  unit_price_cents: number;
  used_total: number;
};

export type UsageVoice = {
  remaining: number;
  remaining_minutes: number;
  unit_price_cents: number;
  used_total: number;
};

export type UsageBucket = {
  balance_cents: number;
  messages: UsageMessages;
  voice_notes?: UsageVoice;
  live_chat?: UsageVoice;
  voice?: UsageVoice;
};

export type FreeAllowances = {
  normal: {
    text_free_left: number;
    voice_notes_free_left: number;
    live_chat_free_left: number;
    live_chat_free_left_minutes: number;
  };
  adult: {
    text_free_left: number;
    voice_free_left: number;
    voice_free_left_minutes: number;
  };
};

export interface SingleInfluencerUsageResponse {
  influencer_id: string;
  normal: UsageBucket;
  adult: UsageBucket;
  free_allowances: FreeAllowances;
}

export interface UserUsageResponse {
  influencers: Record<
    string,
    {
      normal: UsageBucket;
      adult: UsageBucket;
    }
  >;
  totals: {
    normal: UsageBucket;
    adult: UsageBucket;
  };
  free_allowances: FreeAllowances;
}
