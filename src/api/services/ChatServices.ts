import { Endpoints } from "../urls";
import { ChatHistoryResponse, ChatIdResponse, SignedUrlResponse } from "../models/chat";
import { apiClient } from "../apis";

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
    getSignedUrl: async (influencer_id: string): Promise<SignedUrlResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.elecenlabs.signed_url,
                {
                    params: {
                        influencer_id
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }
})