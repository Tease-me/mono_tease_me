import { AxiosInstance } from "axios";
import { FollowActionResponse } from "../models/follow";
import { Endpoints } from "../urls";

export const FollowServices = (apiClient: AxiosInstance) => ({
  follow: async (influencerId: string): Promise<FollowActionResponse> => {
    const { data } = await apiClient.post<FollowActionResponse>(
      Endpoints.follow(influencerId)
    );
    return data;
  },
});
