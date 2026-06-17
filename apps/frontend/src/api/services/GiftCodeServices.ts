import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

export type RedeemGiftCodeResponse = {
  ok: boolean;
  diamonds: number;
  new_balance_cents: number;
  new_balance_credits: number;
  payer_name?: string | null;
};

export const GiftCodeServices = (apiClient: AxiosInstance) => ({
  redeemGiftCode: async (code: string): Promise<RedeemGiftCodeResponse> => {
    const res = await apiClient.post(
      Endpoints.giftCodes.redeem,
      { code },
      { skipErrorModal: true },
    );
    return res.data;
  },

  redeemMjpPromoCode: async (
    promoCode: string,
    influencerId: string,
  ): Promise<RedeemGiftCodeResponse> => {
    const res = await apiClient.post(
      Endpoints.promoCodes.redeem,
      { promo_code: promoCode, influencer_id: influencerId },
      { skipErrorModal: true },
    );
    return res.data;
  },
});
