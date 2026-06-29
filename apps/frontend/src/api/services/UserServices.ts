import { Endpoints } from "../urls";
import { UserDetailResponse, SingleInfluencerUsageResponse } from "../models/user";
import { UserGalleryResponse } from "../models/userGallery";
import { AxiosInstance } from "axios";

export const UserServices = (apiClient: AxiosInstance) => ({
    getUserDetails: async (): Promise<UserDetailResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.auth.me,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getUserUsage: async (influencerId: string): Promise<SingleInfluencerUsageResponse> => {
        const me = await apiClient.get(Endpoints.auth.me);
        const userId = me.data.id;

        const response = await apiClient.get(Endpoints.user.usage(String(userId)), {
            params: influencerId ? { influencer_id: influencerId } : undefined,
        });

        return response.data;
    },
    getUserGallery: async (influencerId: string): Promise<UserGalleryResponse> => {
        const response = await apiClient.get(Endpoints.user.gallery, {
            params: { influencer_id: influencerId },
        });
        return response.data;
    },
})


