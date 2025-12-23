import { AxiosInstance } from "axios";
import { FollowActionResponse, FollowListResponse } from "../models/follow";
import { Endpoints } from "../urls";

export const FollowServices = (apiClient: AxiosInstance) => ({
  follow: async (influencerId: string): Promise<FollowActionResponse> => {
    const { data } = await apiClient.post<FollowActionResponse>(
      Endpoints.follow.follow(influencerId)
    );
    return data;
  },
  list: async (
    params?: { limit?: number; offset?: number }
  ): Promise<FollowListResponse> => {
    const { data } = await apiClient.get<FollowListResponse>(
      Endpoints.follow.list,
      {
        params,
      }
    );
    return data;
  },
});
