import { TEASE_ME_HOST, TEASE_ME_PROTOCOL, TEASE_ME_WS_PROTOCOL } from "@/env";

export const API_BASE_URL = `${TEASE_ME_PROTOCOL}://${TEASE_ME_HOST}`;
export const WS_BASE_URL = `${TEASE_ME_WS_PROTOCOL}://${TEASE_ME_HOST}`;

export const Endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refreshToken: "/auth/refresh",
    forgotPassword: "/auth/forgot-password",
    confirmEmail: "/auth/confirm-email",
    resendVerificationEmail: "/auth/resend-verification-email",
    me: "/auth/me",
    resetPassword: "/auth/reset-password"
  },
  pre_influencers: {
    login: "/pre-influencers/login",
    register: "/pre-influencers/register",
    refreshToken: "/pre-influencers/refresh",
    forgotPassword: "/pre-influencers/forgot-password",
    resendSurvey: "/pre-influencers/resend-survey",
    me: "/pre-influencers/me",
  },
  billing: {
    balance: "/billing/balance",
    topUp: "/billing/topup",
    createCheckout: "/billing/create-checkout",
    verifyCheckout: "/billing/verify-checkout",
  },
  chat: {
    start: "/chat",
    history: (chat_id: string) => `/chat/history/${chat_id}`,
    audio: "/chat/chat_audio",
  },
  chat18: {
    start: "/chat18",
    history: (chat_id: string) => `/chat18/history/${chat_id}`,
    audio: "/chat18/chat_audio",
  },
  knowledge: {
    list: (influencerId: string) => `/influencer/${influencerId}/knowledge`,
    upload: (influencerId: string) =>
      `/influencer/${influencerId}/knowledge/upload`,
    delete: (influencerId: string, fileId: number) =>
      `/influencer/${influencerId}/knowledge/${fileId}`,
  },
  samples: (influencerId: string) => `/influencer/${influencerId}/samples`,
  push: {
    subscribe: "/push/subscribe",
  },
  follow: {
    list: "/follow",
    follow: (influencerId: string) => `/follow/${encodeURIComponent(influencerId)}`,
  },
  elevenlabs: {
    signed_url: "/elevenlabs/signed-url",
    signed_url_free: "/elevenlabs/signed-url-free",
    signed_landing_url_free: "/elevenlabs/signed-url-free-landing",
    callDetails: (conversationId: string) =>
      `/elevenlabs/calls/${encodeURIComponent(conversationId)}`,
    register: (conversationId: string) =>
      `/elevenlabs/conversations/${encodeURIComponent(
        conversationId
      )}/register`,
    conversation_token: "/elevenlabs/conversation-token",
  },
  influencers: "/influencer",
  influencer: (id: string) => `/influencer/${id}`,
  influencerBio: (id: string) => `/influencer/${id}/bio`,
  relationship_update: `influencer/relationship_update`,
  adult_characters: (id: string) => `/influencer/${id}/adult-characters`,
  uploadCsv: "persona/import-csv",
  admin: {
    adultCharacters: {
      list: `admin/adult-characters`,
      byId: (characterId: number) => `admin/adult-characters/${characterId}`,
      assets: (characterId: number) => `admin/adult-characters/${characterId}/assets`,
    },
    influencerAdultCharacters: {
      list: (influencerId: string) =>
        `admin/influencer/${encodeURIComponent(influencerId)}/adult-characters`,
      assets: (influencerId: string, characterId: number) =>
        `admin/influencer/${encodeURIComponent(influencerId)}/adult-characters/${characterId}/assets`,
      assetByType: (influencerId: string, characterId: number, assetType: string) =>
        `admin/influencer/${encodeURIComponent(influencerId)}/adult-characters/${characterId}/assets/${assetType}`,
    },
    systemPrompts: {
      list: "admin/system-prompts",
      byKey: (key: string) => `admin/system-prompts/${encodeURIComponent(key)}`,
    },
    history: (chat_id: string) => `admin/chats/history/${chat_id}`,
    users: (q?: string) =>
      q?.trim()
        ? `admin/users?q=${encodeURIComponent(q.trim())}`
        : `admin/users`,

    relationships: (user_id: number) =>
      `admin/relationships?user_id=${user_id}`,

    patchRelationship: `admin/relationships`,
    analytics: {
      usageSummary: (
        period: string = "24h",
        groupBy: string = "category"
      ) =>
        `admin/api-usage/summary?period=${period}&group_by=${groupBy}`,
      topUsers: (period: string = "24h") => `admin/api-usage/top-users?period=${period}`,
      topInfluencers: (period: string = "24h") => `admin/api-usage/top-influencers?period=${period}`,
      errors: (period: string = "24h") => `admin/api-usage/errors?period=${period}`,
      // User analytics
      overview: `admin/analytics/overview`,
      userGrowth: (period: string = "30d") => `admin/analytics/user-growth?period=${period}`,
      userEngagement: (period: string = "24h") => `admin/analytics/user-engagement?period=${period}`,
      userSpending: (period: string = "30d") => `admin/analytics/user-spending?period=${period}`,
      userRetention: (period: string = "30d") => `admin/analytics/user-retention?period=${period}`,
      userDetail: (userId: number) => `admin/analytics/user-detail/${userId}`,
    },
    knowledge: {
      get: (influencerId: string) => `admin/influencers/${encodeURIComponent(influencerId)}/knowledge`,
      upsert: (influencerId: string) => `admin/influencers/${encodeURIComponent(influencerId)}/knowledge`,
      delete: (influencerId: string) => `admin/influencers/${encodeURIComponent(influencerId)}/knowledge`,
    },
    chatInfo: (influencerId: string, userId: number) =>
      `admin/chats/info/${encodeURIComponent(influencerId)}/${userId}`,
    pairHistory: (influencerId: string, userId: number) =>
      `admin/chats/history/${encodeURIComponent(influencerId)}/${userId}`,
    logs: `admin/logs`,
    logFiles: `admin/logs/files`,
    logDownload: `admin/logs/download`,
    logStream: `admin/logs/stream`,
  },
  subscriptions: {
    start: "/subscriptions/start",
    plans: "/subscriptions/plans",
    cancel: "/subscriptions/cancel",
    // capture removed — verification happens via /billing/verify-checkout
    list: "/subscriptions/me",
    influencer: (influencerId: string) => `/subscriptions/${influencerId}`,
    influencerActivate: (influencerId: string) => `/subscriptions/${influencerId}/18`,
    addons_purchase: "/subscriptions/addons/purchase"
  },
  verification: {
    session: "/verification/session",
    sessionStatus: (sessionId: string) => `/verification/session/${sessionId}`,
    sessionComplete: (sessionId: string) => `/verification/session/${sessionId}/complete`,
    status: "/verification/status",
    history: "/verification/history",
    webhook: "/verification/webhook",
  },
  ws: {
    chat: "/chat/ws",
    chat18: "/chat18/ws",
    notifications: "/ws/notifications",
  },
  user: {
    usage: (id: string) => `/user/${id}/usage`,
  }
} as const;
