import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";
import { UserDetailResponse } from "../models/user";

export const PreInfluencerServices = (apiClient: AxiosInstance) => ({
  getMe: async (): Promise<UserDetailResponse | null> => {
    try {
      const response = await apiClient.get(Endpoints.pre_influencers.me);
      return response.data;
    } catch (error: any) {
      // If 401 or 404, user is not a pre-influencer
      if (error?.response?.status === 401 || error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
});

