import { InfluencerResponse } from "../models/influencers";
import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const InfluencerServices = (apiClient: AxiosInstance) => ({
    getInfluencers: async (): Promise<InfluencerResponse[]> => {
        try {
            const response = await apiClient.get(
                Endpoints.influencers,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getInfluencer: async (influencer_id: string) => {
        try {
            const response = await apiClient.get(
                Endpoints.influencer(influencer_id),
            );
            return response.data;
        } catch (error) {
            throw error
        }
    },
    patchInfluencer: async (influencer_id: string, display_name: string, prompt_template: string, daily_scripts: string[]): Promise<InfluencerResponse> => {
        try {
            const response = await apiClient.patch(
                Endpoints.influencer(influencer_id),
                {
                    "display_name": display_name,
                    "prompt_template": prompt_template,
                    "daily_scripts": daily_scripts
                }
            );
            return response.data;
        } catch (error) {
            throw error
        }
    }
})