import { InfluencerServices } from "@/api/services/InfluencerService";
import { apiClient } from "@/api/apis";
import { InfluencerDataModel } from "../models/InfluencerDataModel";
import dummy from "@/dummy/dummy";
import { InfluencerResponse } from "@/api/models/influencers";
import { KnowledgeFile } from "@/api/models/knowledgeFiles";
import { KnowledgeFileModel } from "../models/InfluencerDataModel";
import defaultAvatar from "@/assets/empty-profile.png";

const influencerServices = InfluencerServices(apiClient);

const resolveAvatar = (requested?: string, influencerId?: string): string => {
    if (requested && requested.trim().length > 0) {
        return requested.trim();
    }
    if (influencerId) {
        try {
            const dummyImage = dummy.getImage(influencerId as "loli" | "bella" | "anna") as string | undefined;
            if (dummyImage) {
                return dummyImage;
            }
        } catch {
            // ignore
        }
    }
    return defaultAvatar;
};

export const InfluencerRepo = () => ({
    getInfluencers: async (): Promise<InfluencerDataModel[]> => {
        try {
            const response: InfluencerResponse[] = await influencerServices.getInfluencers();

            return response.map(item => {
                return {
                    id: item.id,
                    name: item.display_name,
                    username: item.id,
                    img: resolveAvatar(undefined, item.id),
                    videoUrl: dummy.getVideo(item.id as "loli" | "bella" | "anna"),
                    daily_scripts: item.daily_scripts,
                    prompt_template: item.prompt_template,
                    influencer_agent_id_third_part: item.influencer_agent_id_third_part,
                    voice_prompt: item.voice_prompt,
                    voice_id: item.voice_id,
                    created_at: item.created_at,
                    earnings: 0,
                    isSelected: false,
                }
            })
        } catch (e) {
            throw e;
        }
    },
    getInfluencer: async (influencer_id: string): Promise<InfluencerDataModel> => {
        try {
            const response: InfluencerResponse = await influencerServices.getInfluencer(influencer_id);
            return {
                id: response.id,
                name: response.display_name,
                username: response.id,
                img: resolveAvatar(undefined, response.id),
                videoUrl: dummy.getVideo(response.id as "loli" | "bella" | "anna"),
                daily_scripts: response.daily_scripts,
                prompt_template: response.prompt_template,
                influencer_agent_id_third_part: response.influencer_agent_id_third_part,
                earnings: 0,
                created_at: "",
                isSelected: false,
            }
        } catch (e) {
            throw e;
        }
    },
    patchInfluencer: async (
        influencer: InfluencerDataModel,
        prompt_template?: string,
        daily_scripts?: string[],
        influencer_agent_id_third_part?: string,
        voice_prompt?: string,
        voice_id?: string,
    ) => {
        try {
            const response: InfluencerResponse = await influencerServices.patchInfluencer(
                influencer.id,
                influencer.name,
                (prompt_template ?? influencer.prompt_template ?? ""),
                (daily_scripts ?? influencer.daily_scripts ?? []),
                (influencer_agent_id_third_part ?? influencer.influencer_agent_id_third_part),
                (voice_prompt ?? influencer.voice_prompt),
                (voice_id ?? influencer.voice_id),
            );
            return {
                id: response.id,
                name: response.display_name,
                username: response.id,
                img: resolveAvatar(influencer.img, response.id),
                videoUrl: dummy.getVideo(response.id as "loli" | "bella" | "anna"),
                daily_scripts: response.daily_scripts,
                prompt_template: response.prompt_template,
                influencer_agent_id_third_part: response.influencer_agent_id_third_part,
                voice_prompt: response.voice_prompt,
                voice_id: response.voice_id,
                created_at: response.created_at,
                earnings: influencer.earnings,
                isSelected: influencer.isSelected,
            }
        } catch (e) {
            throw e
        }
    },
    createInfluencer: async (influencer: InfluencerDataModel) => {
        try {
            const response: InfluencerResponse = await influencerServices.createInfluencer(
                influencer.id,
                influencer.prompt_template ?? "",
                influencer.name,
                influencer.daily_scripts,
                influencer.influencer_agent_id_third_part,
                influencer.voice_prompt,
                influencer.voice_id,
            );
            return {
                id: response.id,
                name: response.display_name,
                username: response.id,
                img: resolveAvatar(influencer.img, response.id),
                videoUrl: dummy.getVideo(response.id as "loli" | "bella" | "anna"),
                daily_scripts: response.daily_scripts,
                prompt_template: response.prompt_template,
                influencer_agent_id_third_part: response.influencer_agent_id_third_part,
                voice_prompt: response.voice_prompt,
                voice_id: response.voice_id,
                created_at: response.created_at,
                earnings: influencer.earnings,
                isSelected: influencer.isSelected,
            }
        } catch (e) {
            throw e
        }
    },
    uploadCsv: async (file: File, save: boolean): Promise<void> => {
        try {
            await influencerServices.uploadCsv(
                file,
                save
            );
        } catch (e) {
            throw e
        }
    },
    listKnowledgeFiles: async (influencer_id: string): Promise<KnowledgeFileModel[]> => {
        try {
            const response: KnowledgeFile[] = await influencerServices.listKnowledgeFiles(influencer_id);
            return response.map((item) => ({
                id: item.id ?? item.file_id ?? 0,
                filename: item.filename,
                file_type: item.file_type,
                file_size_bytes: item.file_size_bytes,
                status: item.status,
                error_message: item.error_message,
                created_at: item.created_at,
                updated_at: item.updated_at,
            }));
        } catch (e) {
            throw e;
        }
    },
    uploadKnowledgeFile: async (influencer_id: string, file: File): Promise<KnowledgeFileModel> => {
        try {
            const item = await influencerServices.uploadKnowledgeFile(influencer_id, file);
            return {
                id: item.id ?? item.file_id ?? 0,
                filename: item.filename,
                file_type: item.file_type ?? (item.filename.split(".").pop() || "").toLowerCase(),
                file_size_bytes: item.file_size_bytes ?? file.size ?? 0,
                status: item.status,
                error_message: item.error_message ?? null,
                created_at: item.created_at ?? "",
                updated_at: item.updated_at ?? "",
            };
        } catch (e) {
            throw e;
        }
    },
    deleteKnowledgeFile: async (influencer_id: string, file_id: number): Promise<void> => {
        try {
            await influencerServices.deleteKnowledgeFile(influencer_id, file_id);
        } catch (e) {
            throw e;
        }
    },
})
