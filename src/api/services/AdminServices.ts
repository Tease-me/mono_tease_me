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

export interface KnowledgeUpsertResponse {
  ok: boolean;
  influencer_id: string;
  document_id: number;
  chunk_count: number;
  updated_at?: string | null;
}

export interface KnowledgeGetResponse {
  ok: boolean;
  influencer_id: string;
  document_id: number;
  text: string;
  text_hash?: string | null;
  chunk_count: number;
  updated_at?: string | null;
}

export interface KnowledgeDeleteResponse {
  ok: boolean;
  influencer_id: string;
  deleted: boolean;
}

export type ChatInfoStats = {
  chats_count: number;
  messages_count: number;
  memories_count: number;
  calls_count: number;
};

export type AdminChatInfoResponse = {
  ok: boolean;
  influencer_id: string;
  user_id: number;
  from?: string | null;
  to?: string | null;
  normal: ChatInfoStats;
  adult: ChatInfoStats;
  total: ChatInfoStats;
};

export type AdminClearHistoryResponse = {
  ok: boolean;
  influencer_id: string;
  user_id: number;
  mode: string;
  chat_ids_targeted: string[];
  chat_18_ids_targeted: string[];
  messages_deleted: number;
  messages_18_deleted: number;
  memories_deleted: number;
  call_records_deleted: number;
  chats_deleted: number;
  chats_18_deleted: number;
  redis_keys_cleared: string[];
  redis_clear_failures: string[];
};

export type HistoryClearMode = "normal" | "adult" | "both";

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

  getKnowledge: async (influencerId: string): Promise<KnowledgeGetResponse> => {
    const response = await apiClient.get(Endpoints.admin.knowledge.get(influencerId));
    return response.data;
  },

  upsertKnowledge: async (influencerId: string, text: string): Promise<KnowledgeUpsertResponse> => {
    const response = await apiClient.put(Endpoints.admin.knowledge.upsert(influencerId), { text });
    return response.data;
  },

  deleteKnowledge: async (influencerId: string): Promise<KnowledgeDeleteResponse> => {
    const response = await apiClient.delete(Endpoints.admin.knowledge.delete(influencerId));
    return response.data;
  },

  getChatInfo: async (
    influencerId: string,
    userId: number,
    from?: string,
    to?: string
  ): Promise<AdminChatInfoResponse> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params}` : "";
    const response = await apiClient.get(
      Endpoints.admin.chatInfo(influencerId, userId) + qs
    );
    return response.data;
  },

  clearPairHistory: async (
    influencerId: string,
    userId: number,
    mode: HistoryClearMode = "both"
  ): Promise<AdminClearHistoryResponse> => {
    const response = await apiClient.delete(
      Endpoints.admin.pairHistory(influencerId, userId),
      { params: { mode } }
    );
    return response.data;
  },
});
