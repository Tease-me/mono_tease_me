import { InfluencerServices } from "@/api/services/InfluencerService";
import { apiClient } from "@/api/apis";
import { InfluencerDataModel } from "../models/InfluencerDataModel";

const influencerServices = InfluencerServices(apiClient);

export const InfluencerRepo = () => ({
    getInfluencers: async (): Promise<InfluencerDataModel[]> => {
        var totalMessages = 0;
        try {
            const response: InfluencerResponse[] = await influencerServices.getInfluencers();

            return response.map(item => {
                return {
                    id: item.id,
                    name: item.display_name,
                    username: item.id,
                }
            })
        } catch (e) {
            throw e;
        }
    },
})