export type LoginBonusStatus = "none" | "pending" | "granted";

export interface UserDetailResponse {
  id: number;
  full_name?: string;
  username?: string;
  email: string;
  is_verified?: boolean;
  is_varified?: boolean;
  verification_required?: boolean;
  profile_photo_url?: string;
  login_bonus_status: LoginBonusStatus;
}

export type UsageMessages = {
  remaining: number;
  unit_price_cents: number;
  used_total: number;
  used_today: number;
  free_left: number;
};

export type UsageVoice = {
  remaining: number;
  remaining_paid: number;
  remaining_minutes: number;
  unit_price_cents: number;
  used_total: number;
  used_today: number;
  free_left: number;
  last_call_seconds?: number;
  last_call_minutes?: number;
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

export type LatestAdultCallSummary = {
  conversation_id: string;
  status: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  adult_character_id: number | null;
  cost_cents: number | null;
  cost_credits: number | null;
};

export interface SingleInfluencerUsageResponse {
  influencer_id: string;
  normal: UsageBucket;
  adult: UsageBucket;
  free_allowances: FreeAllowances;
  latest_adult_call_summary: LatestAdultCallSummary | null;
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
