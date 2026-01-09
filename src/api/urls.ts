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
    me: "/auth/me",
    resetPassword: "/auth/reset-password"
  },
  pre_influencers: {
    login: "/pre-influencers/login",
    register: "/pre-influencers/register",
    refreshToken: "/pre-influencers/refresh",
    forgotPassword: "/pre-influencers/forgot-password",
    me: "/pre-influencers/me",
  },
  billing: {
    balance: "/billing/balance",
    topUp: "/billing/topup",
    paypalCreateOrder: "/billing/paypal/create-order",
    paypalCapture: "/billing/paypal/capture",
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
    register: (conversationId: string) =>
      `/elevenlabs/conversations/${encodeURIComponent(
        conversationId
      )}/register`,
    conversation_token: "/elevenlabs/conversation-token",
  },
  influencers: "/influencer",
  influencer: (id: string) => `/influencer/${id}`,
  uploadCsv: "persona/import-csv",
  mcpToolsCall: "/mcp/tools/call",
  admin: {
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
  },
  subscription: {
    start: "/subscription/start",
    capture: "/subscription/paypal/capture",
    list: "/subscription/me",
    influencer: (influencerId: string) => `/subscription/me/${influencerId}`,
  },
  ws: {
    chat: "/chat/ws",
    chat18: "/chat18/ws",
    notifications: "/ws/notifications",
  },
} as const;
