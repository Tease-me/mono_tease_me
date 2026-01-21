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

export type PayPalCreateOrderReq = {
  cents: number;
  currency?: string;
  influencer_id: string;
};

export type PayPalCreateOrderRes = {
  order_id: string;
  approve_url: string;
};

export type PayPalCaptureReq = {
  order_id: string;
  influencer_id?: string;
};

export type PayPalCaptureRes = {
  ok: boolean;
  status?: string;
  credited?: boolean;
  new_balance_cents?: number;
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

  paypalCreateOrder: async (
    payload: PayPalCreateOrderReq
  ): Promise<PayPalCreateOrderRes> => {
    const res = await apiClient.post(
      Endpoints.billing.paypalCreateOrder,
      payload
    );
    return res.data;
  },

  paypalCapture: async (
    payload: PayPalCaptureReq
  ): Promise<PayPalCaptureRes> => {
    const res = await apiClient.post(Endpoints.billing.paypalCapture, payload);
    return res.data;
  },
});
