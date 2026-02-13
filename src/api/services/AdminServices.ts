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

  /* ── API-Usage Analytics ─────────────────────────────── */

  getApiUsageSummary: async (
    period = "24h",
    groupBy = "category"
  ): Promise<ApiUsageSummaryResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.apiUsage.summary(period, groupBy)
    );
    return response.data;
  },

  getTopApiUsers: async (
    period = "24h"
  ): Promise<TopApiUsersResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.apiUsage.topUsers(period)
    );
    return response.data;
  },

  getTopApiInfluencers: async (
    period = "24h"
  ): Promise<TopApiInfluencersResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.apiUsage.topInfluencers(period)
    );
    return response.data;
  },

  getApiErrors: async (
    period = "24h"
  ): Promise<ApiErrorsResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.apiUsage.errors(period)
    );
    return response.data;
  },
});

/* ── Analytics Response Types ──────────────────────────── */

export type UsageGroupRow = {
  key: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_micros: number;
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
  cutoff: string;
  groups: UsageGroupRow[];
};

export type TopApiUser = {
  user_id: number;
  total_calls: number;
  total_tokens: number;
  total_cost_micros: number;
  estimated_cost_usd: number;
};

export type TopApiUsersResponse = {
  period: string;
  users: TopApiUser[];
};

export type TopApiInfluencer = {
  influencer_id: string;
  total_calls: number;
  total_tokens: number;
  total_cost_micros: number;
  estimated_cost_usd: number;
  total_call_secs: number;
};

export type TopApiInfluencersResponse = {
  period: string;
  influencers: TopApiInfluencer[];
};

export type ApiErrorRow = {
  id: number;
  created_at: string;
  category: string;
  provider: string;
  model: string;
  purpose: string;
  user_id: number | null;
  influencer_id: string | null;
  error_message: string | null;
};

export type ApiErrorsResponse = {
  period: string;
  total_errors: number;
  errors: ApiErrorRow[];
};
