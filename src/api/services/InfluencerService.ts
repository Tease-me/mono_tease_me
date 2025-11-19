import { InfluencerResponse } from "../models/influencers";
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
        elevenlabs_agent_id?: string,
        voice_prompt?: string,
        voice_id?: string
    ): Promise<InfluencerResponse> => {
        try {
            const response = await apiClient.post(Endpoints.mcpToolsCall, {
                name: "update_influencer",
                arguments: {
                    influencer_id,
                    display_name,
                    prompt_template,
                    daily_scripts,
                    ...(elevenlabs_agent_id !== undefined && { influencer_agent_id_third_part: elevenlabs_agent_id }),
                    ...(voice_prompt !== undefined && { voice_prompt }),
                    ...(voice_id !== undefined && { voice_id }),
                },
            });
            const content = (response.data && response.data.content) || response.data || {};
            return {
                display_name: content.display_name ?? display_name,
                prompt_template: content.prompt_template ?? prompt_template,
                daily_scripts: content.daily_scripts ?? daily_scripts,
                id: content.id ?? influencer_id,
                influencer_agent_id_third_part: content.influencer_agent_id_third_part ?? elevenlabs_agent_id ?? "",
                voice_prompt: content.voice_prompt ?? voice_prompt ?? "",
                voice_id: content.voice_id ?? voice_id ?? "",
                created_at: content.created_at ?? "",
            };
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
})
