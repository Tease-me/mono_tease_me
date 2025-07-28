import { TEASE_ME_HOST, TEASE_ME_PROTOCOL, TEASE_ME_WS_PROTOCOL } from "./env";

const API_BASE_URL = `${TEASE_ME_PROTOCOL}://${TEASE_ME_HOST}`;

const AUTH_URL = `${API_BASE_URL}/auth`;

export const Endpoints = {
    LOGIN: `${AUTH_URL}/login`,
    REGISTER: `${AUTH_URL}/register`,
    REFRESH_TOKEN: `${AUTH_URL}/refresh`,
    ME: `${AUTH_URL}/me`,
    CHAT: `${API_BASE_URL}/chat`,
    HISTORY: `${API_BASE_URL}/history`,
    CHAT_AUDIO: `${API_BASE_URL}/chat_audio`,
}

const WEB_SHOCKET_URL = `${TEASE_ME_WS_PROTOCOL}://${TEASE_ME_HOST}`;
const CHAT_URL = `${WEB_SHOCKET_URL}/ws/chat`;

export const WsEndpoints = {
    CHAT: `${CHAT_URL}`,
}