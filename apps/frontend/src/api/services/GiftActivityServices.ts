import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

export type GiftActivityItem = {
  user_id: number;
  influencer_id: string;
  name: string | null;
  email: string;
  date: string | null;
  ref: string | null;
  lifetime_cents: number;
  last_deposit_cents: number;
  gift_status: string;
  gift_code: string | null;
  gift_id: number | null;
  diamonds: number | null;
  is_first_deposit: boolean;
  deposit_count: number;
};

export type GiftActivityResponse = {
  items: GiftActivityItem[];
  pending_count: number;
};

export type SendGiftResponse = {
  ok: boolean;
  code: string;
  status: string;
  diamonds: number;
  expires_at: string;
};

export const GiftActivityServices = (apiClient: AxiosInstance) => ({
  getGiftActivity: async (
    search?: string,
    influencerId?: string,
  ): Promise<GiftActivityResponse> => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (influencerId) params.influencer_id = influencerId;
    const res = await apiClient.get(Endpoints.giftCodes.activity, {
      params: Object.keys(params).length ? params : undefined,
    });
    return res.data;
  },

  sendGift: async (
    userId: number,
    influencerId: string,
  ): Promise<SendGiftResponse> => {
    const res = await apiClient.post(Endpoints.giftCodes.send(userId), null, {
      params: { influencer_id: influencerId },
    });
    return res.data;
  },

  getPendingGiftCount: async (): Promise<{ pending_count: number }> => {
    const res = await apiClient.get(Endpoints.giftCodes.pendingCount);
    return res.data;
  },
});
