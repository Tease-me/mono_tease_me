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

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type LogLine = {
  ts: string;
  level: LogLevel;
  logger: string;
  message: string;
  raw: string;
  file: string;
  line_no: number;
};

export type AdminLogsResponse = {
  ok: boolean;
  items: LogLine[];
  next_cursor: string | null;
  prev_cursor: string | null;
  applied_filters: {
    q?: string;
    level?: LogLevel;
    file?: string;
    limit: number;
    direction: string;
  };
  redaction_applied: boolean;
};

export type LogFileInfo = {
  name: string;
  size_bytes: number;
  modified_at: string;
  is_current: boolean;
};

export type AdminLogFilesResponse = {
  ok: boolean;
  files: LogFileInfo[];
};

export type AdminLogsParams = {
  q?: string;
  level?: LogLevel | "";
  file?: string;
  limit?: number;
  cursor?: string;
  direction?: "backward" | "forward";
};

/* ── User Analytics Types ──────────────────────────────────── */

export type AnalyticsOverview = {
  total_users: number;
  dau: number;
  revenue_today_usd: number;
  revenue_month_usd: number;
  active_subscriptions: number;
  messages_today: number;
  calls_today: number;
  top_influencers: { influencer_id: string; followers: number }[];
};

export type UserGrowthDay = { date: string; count: number };
export type UserGrowthResponse = {
  period: string;
  total_users: number;
  verified_users: number;
  unverified_users: number;
  identity_verified: number;
  age_verified: number;
  daily_signups: UserGrowthDay[];
};

export type EngagementTopUser = {
  user_id: number;
  username: string | null;
  messages: number;
  calls: number;
};
export type UserEngagementResponse = {
  period: string;
  active_users: number;
  total_messages: number;
  total_calls: number;
  total_call_duration_secs: number;
  channel_breakdown: Record<string, number>;
  relationship_stages: Record<string, number>;
  top_active_users: EngagementTopUser[];
};

export type SpendingTopUser = {
  user_id: number;
  username: string | null;
  total_spent: number;
};
export type UserSpendingResponse = {
  period: string;
  total_revenue_usd: number;
  total_topups_usd: number;
  total_subscriptions_usd: number;
  arpu_usd: number;
  paying_users: number;
  subscription_status_breakdown: Record<string, number>;
  wallet_total_balance: number;
  top_spenders: SpendingTopUser[];
};

export type RetentionDay = { date: string; active: number };
export type UserRetentionResponse = {
  period: string;
  dau: number;
  wau: number;
  mau: number;
  stickiness_ratio: number;
  new_today: number;
  new_this_week: number;
  daily_active_trend: RetentionDay[];
};

export type UserDetailResponse = {
  profile: Record<string, any>;
  wallets: any[];
  subscriptions: any[];
  messages_count: number;
  calls_count: number;
  total_call_duration_secs: number;
  relationships: any[];
  violations: any[];
  total_topups_usd: number;
  total_api_cost_usd: number;
};

export type AdminAdultCharacter = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  first_messages: string[] | null;
  prompt_template: string;
  default_artwork_key: string | null;
  default_artwork_url: string | null;
  lottie_text: string | null;
  lottie_text_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminAdultCharacterCreatePayload = {
  slug: string;
  name: string;
  prompt_template: string;
  description?: string | null;
  short_description?: string | null;
  first_messages?: string[] | null;
  default_artwork_key?: string | null;
  lottie_text?: string | null;
  is_active?: boolean;
  display_order?: number;
};

export type AdminAdultCharacterPatchPayload =
  Partial<AdminAdultCharacterCreatePayload>;

export type AdminAdultCharacterAssetsPayload = {
  default_artwork?: File | null;
  lottie_text?: File | null;
};

export type AdminInfluencerCharacter = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  is_active: boolean;
  display_order: number;
  base_lottie_text: string | null;
  photo_url: string | null;
  photo_2x_url: string | null;
  video_mp4_url: string | null;
  video_webm_url: string | null;
  video_preview_png_url: string | null;
  has_photo: boolean;
  has_complete_video_set: boolean;
  resolved_lottie_text: string | null;
  meta_json: Record<string, unknown> | null;
  has_influencer_override: boolean;
};

export type AdminInfluencerCharacterAssetsPayload = {
  photo?: File | null;
  photo_2x?: File | null;
  video_mp4?: File | null;
  video_webm?: File | null;
  video_preview_png?: File | null;
};

export type InfluencerCharacterAssetType =
  | "photo"
  | "photo_2x"
  | "video_mp4"
  | "video_webm"
  | "video_preview_png"
  | "video";

export type AdminInfluencerLandingAssetsResponse = {
  influencer_id: string;
  hero_png_key: string | null;
  hero_png_url: string | null;
  hero_png_2x_key: string | null;
  hero_png_2x_url: string | null;
  signature_png_key: string | null;
  signature_png_url: string | null;
  signature_png_2x_key: string | null;
  signature_png_2x_url: string | null;
  background_video_1_mp4_key: string | null;
  background_video_1_mp4_url: string | null;
  background_video_1_mp4_content_type: string | null;
  background_video_1_webm_key: string | null;
  background_video_1_webm_url: string | null;
  background_video_1_webm_content_type: string | null;
  background_video_1_poster_jpg_key: string | null;
  background_video_1_poster_jpg_url: string | null;
  background_video_2_mp4_key: string | null;
  background_video_2_mp4_url: string | null;
  background_video_2_mp4_content_type: string | null;
  background_video_2_webm_key: string | null;
  background_video_2_webm_url: string | null;
  background_video_2_webm_content_type: string | null;
  background_video_2_poster_jpg_key: string | null;
  background_video_2_poster_jpg_url: string | null;
  background_image_1_key: string | null;
  background_image_1_url: string | null;
  background_image_1_2x_key: string | null;
  background_image_1_2x_url: string | null;
  background_image_2_key: string | null;
  background_image_2_url: string | null;
  background_image_2_2x_key: string | null;
  background_image_2_2x_url: string | null;
  background_image_3_key: string | null;
  background_image_3_url: string | null;
  background_image_3_2x_key: string | null;
  background_image_3_2x_url: string | null;
  has_hero: boolean;
  has_signature: boolean;
  has_background_videos: boolean;
  has_complete_background_images: boolean;
  updated_at: string | null;
};

export type AdminInfluencerLandingAssetsPayload = {
  hero_png?: File | null;
  hero_png_2x?: File | null;
  signature_png?: File | null;
  signature_png_2x?: File | null;
  background_video_1_mp4?: File | null;
  background_video_1_webm?: File | null;
  background_video_1_poster_jpg?: File | null;
  background_video_2_mp4?: File | null;
  background_video_2_webm?: File | null;
  background_video_2_poster_jpg?: File | null;
  background_image_1?: File | null;
  background_image_1_2x?: File | null;
  background_image_2?: File | null;
  background_image_2_2x?: File | null;
  background_image_3?: File | null;
  background_image_3_2x?: File | null;
};

export type AdminTelegramWelcomeMediaResponse = {
  influencer_id: string;
  telegram_audio_key: string | null;
  telegram_audio_url: string | null;
  telegram_audio_content_type: string | null;
  telegram_video_key: string | null;
  telegram_video_url: string | null;
  telegram_video_content_type: string | null;
  has_audio: boolean;
  has_video: boolean;
  updated_at: string | null;
};

// Telegram Funnel Types
export interface FunnelStage {
  stage: string;
  users: number;
}

export interface FunnelConversionRate {
  from: string;
  to: string;
  from_count: number;
  to_count: number;
  rate: number;
  percentage: number;
}

export interface FunnelOverviewResponse {
  period: string;
  stages: FunnelStage[];
  conversion_rates: FunnelConversionRate[];
}

export interface FunnelInfluencerData {
  influencer_id: string;
  stages: FunnelStage[];
  conversion_rates: FunnelConversionRate[];
}

export interface FunnelByInfluencerResponse {
  period: string;
  influencers: FunnelInfluencerData[];
}

export interface FunnelDropoffItem {
  from: string;
  to: string;
  from_count: number;
  to_count: number;
  drop_count: number;
  drop_percentage: number;
}

export interface FunnelDropoffResponse {
  period: string;
  dropoffs: FunnelDropoffItem[];
}

export interface FunnelRevenueInfluencer {
  influencer_id: string;
  topup_cents: number;
  subscription_cents: number;
  total_cents: number;
  total_usd: number;
  topup_count: number;
  subscription_payment_count: number;
}

export interface FunnelRevenueResponse {
  period: string;
  total_cents: number;
  total_usd: number;
  influencers: FunnelRevenueInfluencer[];
}

export interface FunnelEvent {
  id: number;
  event_type: string;
  influencer_id: string;
  user_id: number | null;
  invite_code: string | null;
  session_id: string | null;
  meta: Record<string, any> | null;
  occurred_at: string;
}

export interface FunnelUserJourneyResponse {
  telegram_user_id: number;
  event_count: number;
  events: FunnelEvent[];
}

export interface FunnelCohortStage {
  stage: string;
  users: number;
  percentage: number;
}

export interface FunnelCohort {
  cohort_start: string;
  total_users: number;
  stages: FunnelCohortStage[];
}

export interface FunnelCohortsResponse {
  cohort_days: number;
  cohorts: FunnelCohort[];
}

export const AdminServices = (apiClient: AxiosInstance) => ({
  listAdultCharacters: async (): Promise<AdminAdultCharacter[]> => {
    const response = await apiClient.get(Endpoints.admin.adultCharacters.list);
    return response.data;
  },

  createAdultCharacter: async (
    payload: AdminAdultCharacterCreatePayload
  ): Promise<AdminAdultCharacter> => {
    const response = await apiClient.post(
      Endpoints.admin.adultCharacters.list,
      payload
    );
    return response.data;
  },

  updateAdultCharacter: async (
    characterId: number,
    payload: AdminAdultCharacterPatchPayload
  ): Promise<AdminAdultCharacter> => {
    const response = await apiClient.patch(
      Endpoints.admin.adultCharacters.byId(characterId),
      payload
    );
    return response.data;
  },

  uploadAdultCharacterAssets: async (
    characterId: number,
    payload: AdminAdultCharacterAssetsPayload
  ): Promise<AdminAdultCharacter> => {
    const formData = new FormData();
    if (payload.default_artwork) {
      formData.append("default_artwork", payload.default_artwork);
    }
    if (payload.lottie_text) {
      formData.append("lottie_text", payload.lottie_text);
    }

    const response = await apiClient.post(
      Endpoints.admin.adultCharacters.assets(characterId),
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  listInfluencerAdultCharacters: async (
    influencerId: string
  ): Promise<AdminInfluencerCharacter[]> => {
    const response = await apiClient.get(
      Endpoints.admin.influencerAdultCharacters.list(influencerId)
    );
    return response.data;
  },

  uploadInfluencerCharacterAssets: async (
    influencerId: string,
    characterId: number,
    payload: AdminInfluencerCharacterAssetsPayload
  ): Promise<AdminInfluencerCharacter> => {
    const formData = new FormData();
    if (payload.photo) formData.append("photo", payload.photo);
    if (payload.photo_2x) formData.append("photo_2x", payload.photo_2x);
    if (payload.video_mp4) formData.append("video_mp4", payload.video_mp4);
    if (payload.video_webm) formData.append("video_webm", payload.video_webm);
    if (payload.video_preview_png) {
      formData.append("video_preview_png", payload.video_preview_png);
    }

    const response = await apiClient.post(
      Endpoints.admin.influencerAdultCharacters.assets(influencerId, characterId),
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  deleteInfluencerCharacterAsset: async (
    influencerId: string,
    characterId: number,
    assetType: InfluencerCharacterAssetType
  ): Promise<AdminInfluencerCharacter> => {
    const response = await apiClient.delete(
      Endpoints.admin.influencerAdultCharacters.assetByType(
        influencerId,
        characterId,
        assetType
      )
    );
    return response.data;
  },

  deleteAdultCharacter: async (characterId: number): Promise<void> => {
    await apiClient.delete(Endpoints.admin.adultCharacters.byId(characterId));
  },

  getInfluencerLandingAssets: async (
    influencerId: string
  ): Promise<AdminInfluencerLandingAssetsResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.influencerLandingAssets(influencerId)
    );
    return response.data;
  },

  uploadInfluencerLandingAssets: async (
    influencerId: string,
    payload: AdminInfluencerLandingAssetsPayload
  ): Promise<AdminInfluencerLandingAssetsResponse> => {
    const formData = new FormData();
    if (payload.hero_png) formData.append("hero_png", payload.hero_png);
    if (payload.hero_png_2x) formData.append("hero_png_2x", payload.hero_png_2x);
    if (payload.signature_png) {
      formData.append("signature_png", payload.signature_png);
    }
    if (payload.signature_png_2x) {
      formData.append("signature_png_2x", payload.signature_png_2x);
    }
    if (payload.background_video_1_mp4) {
      formData.append("background_video_1_mp4", payload.background_video_1_mp4);
    }
    if (payload.background_video_1_webm) {
      formData.append("background_video_1_webm", payload.background_video_1_webm);
    }
    if (payload.background_video_1_poster_jpg) {
      formData.append(
        "background_video_1_poster_jpg",
        payload.background_video_1_poster_jpg
      );
    }
    if (payload.background_video_2_mp4) {
      formData.append("background_video_2_mp4", payload.background_video_2_mp4);
    }
    if (payload.background_video_2_webm) {
      formData.append("background_video_2_webm", payload.background_video_2_webm);
    }
    if (payload.background_video_2_poster_jpg) {
      formData.append(
        "background_video_2_poster_jpg",
        payload.background_video_2_poster_jpg
      );
    }
    if (payload.background_image_1) {
      formData.append("background_image_1", payload.background_image_1);
    }
    if (payload.background_image_1_2x) {
      formData.append("background_image_1_2x", payload.background_image_1_2x);
    }
    if (payload.background_image_2) {
      formData.append("background_image_2", payload.background_image_2);
    }
    if (payload.background_image_2_2x) {
      formData.append("background_image_2_2x", payload.background_image_2_2x);
    }
    if (payload.background_image_3) {
      formData.append("background_image_3", payload.background_image_3);
    }
    if (payload.background_image_3_2x) {
      formData.append("background_image_3_2x", payload.background_image_3_2x);
    }

    const response = await apiClient.post(
      Endpoints.admin.influencerLandingAssets(influencerId),
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  getTelegramWelcomeMedia: async (
    influencerId: string
  ): Promise<AdminTelegramWelcomeMediaResponse> => {
    const response = await apiClient.get(
      Endpoints.admin.telegramWelcomeMedia(influencerId)
    );
    return response.data;
  },

  uploadTelegramWelcomeMedia: async (
    influencerId: string,
    payload: {
      audio?: File | null;
      video?: File | null;
    }
  ): Promise<AdminTelegramWelcomeMediaResponse> => {
    const formData = new FormData();
    if (payload.audio) formData.append("audio", payload.audio);
    if (payload.video) formData.append("video", payload.video);
    const response = await apiClient.post(
      Endpoints.admin.telegramWelcomeMedia(influencerId),
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

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
  getLogs: async (params: AdminLogsParams): Promise<AdminLogsResponse> => {
    const cleanParams: Record<string, string | number> = {};
    if (params.q) cleanParams.q = params.q;
    if (params.level) cleanParams.level = params.level;
    if (params.file) cleanParams.file = params.file;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.cursor) cleanParams.cursor = params.cursor;
    if (params.direction) cleanParams.direction = params.direction;
    const response = await apiClient.get(Endpoints.admin.logs, { params: cleanParams });
    return response.data;
  },

  getLogFiles: async (): Promise<AdminLogFilesResponse> => {
    const response = await apiClient.get(Endpoints.admin.logFiles);
    return response.data;
  },

  downloadLogFile: async (fileName: string): Promise<void> => {
    const response = await apiClient.get(Endpoints.admin.logDownload, {
      params: { file: fileName },
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  /* ── User Analytics ──────────────────────────────────── */

  getAnalyticsOverview: async (): Promise<AnalyticsOverview> => {
    const response = await apiClient.get(Endpoints.admin.analytics.overview);
    const d = response.data;
    // Normalize nested backend shape to frontend flat type
    return {
      total_users: d.total_users ?? d.users?.total ?? 0,
      dau: d.dau ?? d.users?.dau ?? 0,
      revenue_today_usd: d.revenue_today_usd ?? d.revenue?.today_usd ?? 0,
      revenue_month_usd: d.revenue_month_usd ?? d.revenue?.month_usd ?? 0,
      active_subscriptions: d.active_subscriptions ?? d.subscriptions?.active ?? 0,
      messages_today: d.messages_today ?? d.activity?.messages_today ?? 0,
      calls_today: d.calls_today ?? d.activity?.calls_today ?? 0,
      top_influencers: d.top_influencers ?? [],
    };
  },

  getUserGrowth: async (period: string = "30d"): Promise<UserGrowthResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.userGrowth(period));
    return response.data;
  },

  getUserEngagement: async (period: string = "24h"): Promise<UserEngagementResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.userEngagement(period));
    const d = response.data;
    // Normalize backend shape to frontend type
    const channelBreakdown: Record<string, number> = {};
    const channels = d.channel_breakdown ?? d.channels ?? [];
    if (Array.isArray(channels)) {
      channels.forEach((c: any) => { channelBreakdown[c.channel || c.name || "unknown"] = c.count; });
    } else if (channels && typeof channels === "object") {
      Object.assign(channelBreakdown, channels);
    }
    const relStages: Record<string, number> = {};
    const stages = d.relationship_stages ?? [];
    if (Array.isArray(stages)) {
      stages.forEach((s: any) => { relStages[s.stage || s.state || "unknown"] = s.count; });
    } else if (stages && typeof stages === "object") {
      Object.assign(relStages, stages);
    }
    return {
      period: d.period,
      active_users: typeof d.active_users === "number" ? d.active_users : (d.active_users?.text ?? 0) + (d.active_users?.voice ?? 0),
      total_messages: d.total_messages ?? d.messages?.total ?? 0,
      total_calls: d.total_calls ?? d.calls?.total ?? 0,
      total_call_duration_secs: d.total_call_duration_secs ?? d.calls?.total_duration_secs ?? 0,
      channel_breakdown: channelBreakdown,
      relationship_stages: relStages,
      top_active_users: d.top_active_users ?? [],
    };
  },

  getUserSpending: async (period: string = "30d"): Promise<UserSpendingResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.userSpending(period));
    const d = response.data;
    // Normalize backend shape to frontend type
    const subBreakdown: Record<string, number> = {};
    const subs = d.subscription_status_breakdown ?? d.subscriptions ?? [];
    if (Array.isArray(subs)) {
      subs.forEach((s: any) => { subBreakdown[s.status || "unknown"] = s.count; });
    } else if (subs && typeof subs === "object") {
      Object.assign(subBreakdown, subs);
    }
    const topSpenders = (d.top_spenders ?? []).map((s: any) => ({
      user_id: s.user_id,
      username: s.username ?? s.email ?? null,
      total_spent: s.total_spent ?? s.total_usd ?? (s.total_cents ? s.total_cents / 100 : 0),
    }));
    return {
      period: d.period,
      total_revenue_usd: d.total_revenue_usd ?? d.revenue?.total_usd ?? 0,
      total_topups_usd: d.total_topups_usd ?? (d.revenue?.topup_cents != null ? d.revenue.topup_cents / 100 : 0),
      total_subscriptions_usd: d.total_subscriptions_usd ?? (d.revenue?.subscription_cents != null ? d.revenue.subscription_cents / 100 : 0),
      arpu_usd: d.arpu_usd ?? (d.arpu_cents != null ? d.arpu_cents / 100 : 0),
      paying_users: d.paying_users ?? 0,
      subscription_status_breakdown: subBreakdown,
      wallet_total_balance: d.wallet_total_balance ?? (d.wallets?.total_balance_cents != null ? d.wallets.total_balance_cents / 100 : 0),
      top_spenders: topSpenders,
    };
  },

  getUserRetention: async (period: string = "30d"): Promise<UserRetentionResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.userRetention(period));
    const d = response.data;
    // Normalize backend shape (daily_active / stickiness_dau_mau) to frontend type
    const trend = d.daily_active_trend ?? d.daily_active ?? [];
    return {
      period: d.period,
      dau: d.dau ?? 0,
      wau: d.wau ?? 0,
      mau: d.mau ?? 0,
      stickiness_ratio: d.stickiness_ratio ?? d.stickiness_dau_mau ?? 0,
      new_today: d.new_today ?? 0,
      new_this_week: d.new_this_week ?? 0,
      daily_active_trend: trend.map((r: any) => ({
        date: r.date,
        active: r.active ?? r.active_users ?? 0,
      })),
    };
  },

  getUserDetail: async (userId: number): Promise<UserDetailResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.userDetail(userId));
    return response.data;
  },

  /* ── Telegram Funnel ──────────────────────────────────── */

  getTelegramFunnelOverview: async (period: string = "30d"): Promise<FunnelOverviewResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelOverview(period));
    return response.data;
  },

  getTelegramFunnelByInfluencer: async (period: string = "30d"): Promise<FunnelByInfluencerResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelByInfluencer(period));
    return response.data;
  },

  getTelegramFunnelDropoff: async (period: string = "30d"): Promise<FunnelDropoffResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelDropoff(period));
    return response.data;
  },

  getTelegramFunnelRevenue: async (period: string = "30d"): Promise<FunnelRevenueResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelRevenue(period));
    return response.data;
  },

  getTelegramFunnelCohorts: async (cohortDays: number = 7): Promise<FunnelCohortsResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelCohorts(cohortDays));
    return response.data;
  },

  getTelegramFunnelUser: async (telegramUserId: number): Promise<FunnelUserJourneyResponse> => {
    const response = await apiClient.get(Endpoints.admin.analytics.telegramFunnelUser(telegramUserId));
    return response.data;
  },
});
