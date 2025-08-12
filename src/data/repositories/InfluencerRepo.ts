import { InfluencerServices } from "@/api/services/InfluencerService";
import { apiClient } from "@/api/apis";
import { InfluencerDataModel } from "../models/InfluencerDataModel";
import dummy from "@/dummy/dummy";
import { InfluencerResponse } from "@/api/models/influencers";

const influencerServices = InfluencerServices(apiClient);

export const InfluencerRepo = () => ({
    getInfluencers: async (): Promise<InfluencerDataModel[]> => {
        try {
            const response: InfluencerResponse[] = await influencerServices.getInfluencers();

            return response.map(item => {
                return {
                    id: item.id,
                    name: item.display_name,
                    username: item.id,
                    img: dummy.getImage(item.id as "loli" | "bella" | "anna"),
                    videoUrl: dummy.getVideo(item.id as "loli" | "bella" | "anna"),
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
                img: dummy.getImage(response.id as "loli" | "bella" | "anna"),
                videoUrl: dummy.getVideo(response.id as "loli" | "bella" | "anna"),
                daily_scripts: response.daily_scripts,
                prompt_template: response.prompt_template
            }
        } catch (e) {
            throw e;
        }
    },
    patchInfluencer: async (influencer: InfluencerDataModel, prompt_template?: string, daily_scripts?: string[]) => {
        try {
            const response: InfluencerResponse = await influencerServices.patchInfluencer(influencer.id, influencer.name,
                (prompt_template ?? influencer.prompt_template ?? ""),
                (daily_scripts ?? influencer.daily_scripts ?? []));
            return {
                id: response.id,
                name: response.display_name,
                username: response.id,
                img: dummy.getImage(response.id as "loli" | "bella" | "anna"),
                videoUrl: dummy.getVideo(response.id as "loli" | "bella" | "anna"),
                daily_scripts: response.daily_scripts,
                prompt_template: response.prompt_template
            }
        } catch (e) {
            throw e
        }

    }
})