import { TEASE_ME_HOST, TEASE_ME_PROTOCOL, TEASE_ME_WS_PROTOCOL } from "./env";

const API_BASE_URL = `${TEASE_ME_PROTOCOL}://${TEASE_ME_HOST}`;
const WEB_SHOCKET_URL = `${TEASE_ME_WS_PROTOCOL}://${TEASE_ME_HOST}`;

const AUTH_URL = `${API_BASE_URL}/auth`;
const CHAT_URL = `${WEB_SHOCKET_URL}/ws/chat`;
const CHAT_AUDIO_URL = `${API_BASE_URL}/chat_audio`;

export const Endpoints = {
    LOGIN: `${AUTH_URL}/login`,
    REGISTER: `${AUTH_URL}/register`,
    CHAT: `${CHAT_URL}`,
    CHAT_AUDIO: `${CHAT_AUDIO_URL}`,
}