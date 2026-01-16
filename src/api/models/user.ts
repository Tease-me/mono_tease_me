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
  free_left: number;
  used_today: number;
  unit_price_cents: number;
};

export type UsageVoice = {
  remaining: number;
  remaining_minutes: number;
  free_left: number;
  used_today: number;
  unit_price_cents: number;
};

export type UsageBucket = {
  balance_cents: number;
  messages: UsageMessages;
  live_chat?: UsageVoice;
  voice?: UsageVoice; 
};

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
}
