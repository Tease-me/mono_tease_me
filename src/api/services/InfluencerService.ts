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
    },
    createInfluencer: async (
        id: string,
        prompt_template: string,
        display_name?: string,
        daily_scripts?: string[],
        elevenlabs_agent_id?: string,
        voice_prompt?: string,
        voice_id?: string): Promise<InfluencerResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.influencers,
                {
                    "id": id,
                    "display_name": display_name,
                    "prompt_template": prompt_template,
                    ...(daily_scripts && { "daily_scripts": daily_scripts }),
                    ...(elevenlabs_agent_id && { "influencer_agent_id_third_part": elevenlabs_agent_id }),
                    ...(voice_prompt && { "voice_prompt": voice_prompt }),
                    ...(voice_id && { "voice_id": voice_id })
                }
            );
            return response.data;
        } catch (error) {
            throw error
        }
    },
    uploadCsv: async (file: File, save: boolean = false): Promise<void> => {
        try {
            const formData = new FormData();
            formData.append("file", file);

            await apiClient.post(
                Endpoints.uploadCsv,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    params: {
                        save: save
                    }
                },
            );
        } catch (error) {
            throw error
        }
    }
})
