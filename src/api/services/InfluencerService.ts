import { InfluencerBioResponse, InfluencerResponse, InfluencerSampleListResponse, InfluencerSampleResponse } from "../models/influencers";
import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";
import { KnowledgeFile } from "../models/knowledgeFiles";

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
    patchInfluencer: async (
        influencer_id: string,
        display_name: string,
        prompt_template: string,
        daily_scripts: string[],
        influencer_agent_id_third_part?: string,
        bio_json?: unknown,
        voice_id?: string,
        custom_adult_prompt?: string,
    ): Promise<InfluencerResponse> => {
        try {
            const bioPayload = bio_json && typeof bio_json === "object" ? { "bio_json": bio_json } : {};
            const response = await apiClient.patch(
                Endpoints.influencer(influencer_id),
                {
                    "display_name": display_name,
                    "prompt_template": prompt_template,
                    "daily_scripts": daily_scripts,
                    ...(influencer_agent_id_third_part !== undefined && { "influencer_agent_id_third_part": influencer_agent_id_third_part }),
                    ...bioPayload,
                    ...(voice_id !== undefined && { "voice_id": voice_id }),
                    ...(custom_adult_prompt !== undefined && { "custom_adult_prompt": custom_adult_prompt }),
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
        influencer_agent_id_third_part?: string,
        bio_json?: unknown,
        voice_id?: string,
        custom_adult_prompt?: string): Promise<InfluencerResponse> => {
        try {
            const bioPayload = bio_json && typeof bio_json === "object" ? { "bio_json": bio_json } : {};
            const response = await apiClient.post(
                Endpoints.influencers,
                {
                    "id": id,
                    "display_name": display_name,
                    "prompt_template": prompt_template,
                    ...(daily_scripts && { "daily_scripts": daily_scripts }),
                    ...(influencer_agent_id_third_part && { "influencer_agent_id_third_part": influencer_agent_id_third_part }),
                    ...bioPayload,
                    ...(voice_id && { "voice_id": voice_id }),
                    ...(custom_adult_prompt !== undefined && { "custom_adult_prompt": custom_adult_prompt }),
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
    },
    listKnowledgeFiles: async (influencer_id: string): Promise<KnowledgeFile[]> => {
        try {
            const response = await apiClient.get(Endpoints.knowledge.list(influencer_id));
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    uploadKnowledgeFile: async (influencer_id: string, file: File): Promise<KnowledgeFile> => {
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await apiClient.post(Endpoints.knowledge.upload(influencer_id), formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    deleteKnowledgeFile: async (influencer_id: string, file_id: number): Promise<void> => {
        try {
            await apiClient.delete(Endpoints.knowledge.delete(influencer_id, file_id));
        } catch (error) {
            throw error;
        }
    },
    uploadSample: async (influencer_id: string, file: File): Promise<InfluencerSampleResponse> => {
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await apiClient.post(Endpoints.samples(influencer_id), formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    listSamples: async (influencer_id: string): Promise<InfluencerSampleListResponse> => {
        try {
            const response = await apiClient.get<InfluencerSampleListResponse>(
                Endpoints.samples(influencer_id)
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getBio: async (influencer_id: string): Promise<InfluencerBioResponse> => {
        try {
            const response = await apiClient.get<InfluencerBioResponse>(
                Endpoints.influencerBio(influencer_id),
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    relationship_update: async (userText: string | null, conversationId: string | null) => {
        try {
            const response = await apiClient.post(Endpoints.relationship_update, null, {
                params: {
                    user_text: userText,
                    conversation_id: conversationId
                }
            })
            return response.data;
        }
        catch (error) {
            throw error;
        }
    }
})
