import { AxiosInstance } from "axios";
import { RelationshipResponse } from "../models/relationship";

export interface DimensionDetail {
  label: string;
  icon: string;
  short: string;
  full: string;
  guide: string;
  warning: string;
  current_value: number;
}

export interface NextStageRequirements {
  attraction: number;
  closeness: number;
  safety: number;
}

export interface RelationshipDimensions {
  current_stage: string;
  dimensions: {
    trust: DimensionDetail;
    closeness: DimensionDetail;
    attraction: DimensionDetail;
    safety: DimensionDetail;
  };
  next_stage: string;
  next_stage_requirements: NextStageRequirements;
  next_stage_description: string;
  sentiment_score: number;
}

export const RelationshipServices = (apiClient: AxiosInstance) => ({
  getRelationship: async (influencerId: string): Promise<RelationshipResponse> => {
    const res = await apiClient.get(`/relationship/${encodeURIComponent(influencerId)}`);
    return res.data;
  },
  getDimensions: async (influencerId: string): Promise<RelationshipDimensions> => {
    const res = await apiClient.get(`/relationship/${encodeURIComponent(influencerId)}/dimensions`);
    return res.data;
  },
});

