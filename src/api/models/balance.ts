export interface BalanceResponse {
  influencer_id: string;
  balance_cents: number;
  balance_credits: number;
}

export interface TopupResponse {
  ok: true;
  user_id: number;
  influencer_id: string;
  balance_cents: number;
  credited_credits: number;
  balance_credits: number;
  conversion_rate: {
    cents_per_usd: number;
    credits_per_usd: number;
  };
}
