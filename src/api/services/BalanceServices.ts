import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const BalanceServices = (apiClient: AxiosInstance) => ({
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