import { TEASE_ME_HOST, TEASE_ME_PROTOCOL, TEASE_ME_WS_PROTOCOL } from "@/env";

export const API_BASE_URL = `${TEASE_ME_PROTOCOL}://${TEASE_ME_HOST}`;

const AUTH_URL = "/auth";

export const Endpoints = {
    LOGIN: `${AUTH_URL}/login`,
    REGISTER: `${AUTH_URL}/register`,
    REFRESH_TOKEN: `${AUTH_URL}/refresh`,
    FORGOT_PASSWPRD: `${AUTH_URL}/forgot-password`,
    ME: `${AUTH_URL}/me`,
    CHAT: "/chat",
    HISTORY: "/history",
    CHAT_AUDIO: `${API_BASE_URL}/chat_audio`,
}

const WEB_SHOCKET_URL = `${TEASE_ME_WS_PROTOCOL}://${TEASE_ME_HOST}`;

export const WsEndpoints = {
    CHAT: `${WEB_SHOCKET_URL}/ws/chat`,
    NOTIFICATION: `${WEB_SHOCKET_URL}/ws/notifications`
}