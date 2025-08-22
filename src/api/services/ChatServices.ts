import { Endpoints } from "../urls";
import { ChatAudioResponse, ChatHistoryResponse, ChatIdResponse, SignedUrlResponse } from "../models/chat";
import { apiClient } from "../apis";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";

export const ChatServices = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number): Promise<ChatHistoryResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.chat.history(chat_id),
                {
                    params: {
                        page,
                        page_size
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getChatId: async (user_id: number, influencer_id: string): Promise<ChatIdResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.chat.start,
                {
                    "user_id": user_id,
                    "influencer_id": influencer_id
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getSignedUrl: async (influencer_id: string, user_id: number): Promise<SignedUrlResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.elevenlabs.signed_url,
                {
                    params: {
                        influencer_id,
                        user_id
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    registerConversation: async (conversation_id: string, user_id: number, influencer_id: string) => {
        let attempt = 0;
        let delay = 400;
        let maxRetries = 3;
        while (true) {
            try {
                await apiClient.post(Endpoints.elevenlabs.register(conversation_id), {
                    user_id: user_id,
                    influencer_id: influencer_id,
                    sid: crypto.randomUUID()
                });
                return;
            } catch (err: any) {
                attempt += 1;
                if (attempt > maxRetries) {
                    const status = err?.response?.status;
                    const data = err?.response?.data;
                    throw new Error(
                        `register failed (${status ?? "no-status"}): ${JSON.stringify(data)}`
                    );
                }
                await new Promise((r) => setTimeout(r, delay));
                delay = Math.min(2000, Math.floor(delay * 1.8));
            }
        }
    },
    postAudioMessage: async (audioBlob: Blob, influencer_id: string, chat_id: string): Promise<ChatAudioResponse> => {
        const access_token = storage.get(LocalStorageKeys.AccessToken);
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("influencer_id", influencer_id);
        formData.append("chat_id", chat_id);
        formData.append("token", access_token ?? "");
        try {
            const response = await apiClient.post(
                Endpoints.chat.audio,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            return response.data;
        } catch (err) {
            throw err
        }
    }
})