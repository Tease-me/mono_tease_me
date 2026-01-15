import { BalanceResponse, TopupResponse } from "../models/balance";
import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const BalanceServices = (apiClient: AxiosInstance) => ({
    getBalance: async (influencerId: string, is18?: boolean): Promise<BalanceResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.billing.balance,{
                    params: influencerId ? {influencer_id: influencerId, is_18: is18 ?? false} : undefined,

                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    topup: async (amount_cents: number): Promise<TopupResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.billing.topUp,
                {
                    "cents": amount_cents
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }
})