import { Endpoints } from "../urls";
import { ChatAudioResponse, ChatHistoryResponse, ChatIdResponse } from "../models/chat";
import { apiClient } from "../apis";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";

export const AdultChatServices = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number): Promise<ChatHistoryResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.chat18.history(chat_id),
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
                Endpoints.chat18.start,
                {
                    "user_id": user_id,
                    "influencer_id": influencer_id
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error obtaining chat ID:", error);
            throw error;
        }
    },
    postAudioMessage: async (audioBlob: Blob, influencer_id: string, chat_id: string): Promise<ChatAudioResponse> => {
        const access_token = storage.get(LocalStorageKeys.AccessToken);
        const formData = new FormData();
        const mime = audioBlob.type || "audio/mp4";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("aac") ? "aac" : "webm";
        formData.append("file", audioBlob, `audio.${ext}`);
        formData.append("influencer_id", influencer_id);
        formData.append("chat_id", chat_id);
        formData.append("token", access_token ?? "");
        try {
            const response = await apiClient.post(
                Endpoints.chat18.audio,
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
