import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const UserServices = (apiClient: AxiosInstance) => ({
    getInfluencers: async (): Promise<InfluencerResponse[]> => {
        try {
            const response = await apiClient.get(
                Endpoints.influencer,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

})