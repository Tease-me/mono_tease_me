import { Endpoints } from "../urls";
import { ChatIdResponse } from "../models/chat";
import { apiClient } from "../apis";

export const BalanceServices = () => ({
    getBalance: async (): Promise<BalanceResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.BALANCE,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    topup: async (amount_cents: number): Promise<TopupResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.TOP_UP,
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