import { AxiosInstance } from "axios";
import { RelationshipResponse } from "../models/relationship";


export const RelationshipServices = (apiClient: AxiosInstance) => ({
  getRelationship: async (influencerId: string): Promise<RelationshipResponse> => {
    const res = await apiClient.get(`/relationship/${encodeURIComponent(influencerId)}`);
    return res.data;
  },
});

