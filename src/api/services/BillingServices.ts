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
  provider: "stripe" | "paypal";
  plan_id?: number;
  amount_cents?: number;
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
});
