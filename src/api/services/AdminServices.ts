import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

export type AdminUserRow = {
  id: number;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
};

export type AdminRelRow = {
  id: number;
  user_id: number;
  influencer_id: string;
  trust: number;
  closeness: number;
  attraction: number;
  safety: number;
  state: string;
  stage_points: number;
  sentiment_score: number;
  exclusive_agreed: boolean;
  girlfriend_confirmed: boolean;
  updated_at?: string | null;
  sentiment?: string;
};

export type AdminRelPatch = {
  user_id: number;
  influencer_id: string;

  trust?: number;
  closeness?: number;
  attraction?: number;
  safety?: number;

  state?: string;
  stage_points?: number;
  sentiment_score?: number;

  exclusive_agreed?: boolean;
  girlfriend_confirmed?: boolean;

  dtr_stage?: number;
  dtr_cooldown_until?: string; // ISO string
  last_interaction_at?: string; // ISO string
};

export type ApiUsageSummaryGroup = {
  key: string;
  total_calls: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  total_duration_secs: number | null;
  error_count: number;
  error_rate: number;
};

export type ApiUsageSummaryResponse = {
  period: string;
  group_by: string;
  groups: ApiUsageSummaryGroup[];
};

export type TopApiUser = {
  user_id: number;
  total_calls: number;
  total_tokens: number;
  estimated_cost_usd: number;
};

export type TopApiInfluencer = {
  influencer_id: string;
  total_calls: number;
  total_tokens: number;
  estimated_cost_usd: number;
  total_call_secs: number;
};

export type ApiErrorRow = {
  id: number;
  timestamp: string;
  created_at: string;
  category: string;
  provider: string;
  model: string;
  purpose: string;
  error_message: string;
  user_id?: number | null;
  influencer_id?: string | null;
};

export const AdminServices = (apiClient: AxiosInstance) => ({
  getUsers: async (q?: string): Promise<AdminUserRow[]> => {
    const response = await apiClient.get(Endpoints.admin.users(q));
    return response.data;
  },

  getRelationships: async (user_id: number): Promise<AdminRelRow[]> => {
    const response = await apiClient.get(
      Endpoints.admin.relationships(user_id)
    );
    return response.data;
  },

  patchRelationship: async (payload: AdminRelPatch): Promise<any> => {
    const response = await apiClient.patch(
      Endpoints.admin.patchRelationship,
      payload
    );
    return response.data;
  },

  clearChatHistory: async (chat_id: string): Promise<any> => {
    const response = await apiClient.delete(Endpoints.admin.history(chat_id));
    return response.data;
  },

  getApiUsageSummary: async (
    period: string = "24h",
    groupBy: string = "category"
  ): Promise<ApiUsageSummaryResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.analytics.usageSummary(period, groupBy)
    );
    return response.data;
  },

  getTopApiUsers: async (period: string = "24h"): Promise<{ users: TopApiUser[] }> => {
    const response = await apiClient.get(
      Endpoints.admin.analytics.topUsers(period)
    );
    return response.data;
  },

  getTopApiInfluencers: async (period: string = "24h"): Promise<{ influencers: TopApiInfluencer[] }> => {
    const response = await apiClient.get(
      Endpoints.admin.analytics.topInfluencers(period)
    );
    return response.data;
  },

  getApiErrors: async (period: string = "24h"): Promise<{ errors: ApiErrorRow[]; total_errors: number }> => {
    const response = await apiClient.get(
      Endpoints.admin.analytics.errors(period)
    );
    return response.data;
  },
});
