import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

export type BalanceRes = {
  balance_cents: number;
};

export type TopUpReq = {
  cents: number;
};

export type TopUpRes = {
  ok: boolean;
  new_balance_cents: number;
};

// ── External Checkout (tmservice) ──────────────────────────────────

export type CreateCheckoutReq = {
  influencer_id: string;
  purpose: "subscription" | "addon" | "topup";
  provider: "stripe" | "paypal" | "armloop";
  plan_id?: number;
  amount_cents?: number;
  return_url?: string;
};

export type CreateCheckoutRes = {
  checkout_id: string;
  payment_url: string;
  provider: string;
  purpose: string;
  amount_cents: number;
};

export type VerifyCheckoutReq = {
  checkout_id: string;
  session_id?: string;
  session_result?: string;
};

export type VerifyCheckoutRes = {
  ok: boolean;
  checkout_id: string;
  status: string;
  provider: string;
  amount_cents: number;
  balance_cents?: number;
  subscription_id?: number;
  subscription_status?: string;
  purchase_id?: number;
  addon_name?: string;
  credits_added?: number;
  new_balance?: number;
};

export type AdultCharacterSummary = {
  influencer_id: string;
  balance_cents: number;
  estimated_remaining_call_seconds: number | null;
  latest_adult_call_summary: {
    duration_seconds: number | null;
    cost_cents: number | null;
  } | null;
};

export const BillingServices = (apiClient: AxiosInstance) => ({
  getBalance: async (): Promise<BalanceRes> => {
    const res = await apiClient.get(Endpoints.billing.balance);
    return res.data;
  },

  topUp: async (payload: TopUpReq): Promise<TopUpRes> => {
    const res = await apiClient.post(Endpoints.billing.topUp, payload);
    return res.data;
  },

  createCheckout: async (
    payload: CreateCheckoutReq
  ): Promise<CreateCheckoutRes> => {
    const res = await apiClient.post(
      Endpoints.billing.createCheckout,
      payload
    );
    return res.data;
  },

  verifyCheckout: async (
    payload: VerifyCheckoutReq
  ): Promise<VerifyCheckoutRes> => {
    const res = await apiClient.post(
      Endpoints.billing.verifyCheckout,
      payload
    );
    return res.data;
  },

  getAdultCharacterSummary: async (
    influencerId: string
  ): Promise<AdultCharacterSummary> => {
    const res = await apiClient.get(
      Endpoints.billing.adultCharacterSummary(influencerId)
    );
    return res.data;
  },
});
