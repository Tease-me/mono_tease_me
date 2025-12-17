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

  // your GET endpoint also returns this
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

  // optional fields if you enabled them in backend
  dtr_stage?: number;
  dtr_cooldown_until?: string; // ISO string
  last_interaction_at?: string; // ISO string
};

export const AdminServices = (apiClient: AxiosInstance) => ({
  // ✅ GET /admin/users?q=...
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
});
