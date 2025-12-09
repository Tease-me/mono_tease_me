import { TEASE_ME_HOST, TEASE_ME_PROTOCOL, TEASE_ME_WS_PROTOCOL } from "@/env";

export const API_BASE_URL = `${TEASE_ME_PROTOCOL}://${TEASE_ME_HOST}`;
export const WS_BASE_URL = `${TEASE_ME_WS_PROTOCOL}://${TEASE_ME_HOST}`;

export const Endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refreshToken: "/auth/refresh",
    forgotPassword: "/auth/forgot-password",
    me: "/auth/me",
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
  },
  chat: {
    start: "/chat",
    history: (chat_id: string) => `/chat/history/${chat_id}`,
    audio: "/chat/chat_audio",
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
  elevenlabs: {
    signed_url: "/elevenlabs/signed-url",
    signed_url_free: "/elevenlabs/signed-url-free",
    signed_landing_url_free: "/elevenlabs/signed-url-free-landing",
    register: (conversationId: string) =>
      `/elevenlabs/conversations/${encodeURIComponent(
        conversationId
      )}/register`,
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
  },
  ws: {
    chat: "/chat/ws",
    notifications: "/ws/notifications",
  },
} as const;
