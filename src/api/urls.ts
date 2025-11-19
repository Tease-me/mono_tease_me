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
    billing: {
        balance: "/billing/balance",
        topUp: "/billing/topup",
    },
    chat: {
        start: "/chat",
        history: (chat_id: string) => `/chat/history/${chat_id}`,
        audio: "/chat/chat_audio"
    },
    push: {
        subscribe: "/push/subscribe",
    },
    elevenlabs: {
        signed_url: "/elevenlabs/signed-url",
        signed_url_free: "/elevenlabs/signed-url-free",
        register: (conversationId: string) => `/elevenlabs/conversations/${encodeURIComponent(conversationId)}/register`,
    },
    influencers: "/influencer",
    influencer: (id: string) => `/influencer/${id}`,
    uploadCsv: "persona/import-csv",
    mcpToolsCall: "/mcp/tools/call",
    ws: {
        chat: "/chat/ws",
        notifications: "/ws/notifications",
    },
} as const;
