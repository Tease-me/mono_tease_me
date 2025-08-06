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
    chat: "/chat",
    chat_history: "/history",
    chat_audio: "/chat_audio",
    push: {
        subscribe: "/push/subscribe",
    },
    influencers: "/influencer",
    influencer: (id: string) => `/influencer/${id}`,
    ws: {
        chat: "/ws/chat",
        notifications: "/ws/notifications"
    }
} as const;