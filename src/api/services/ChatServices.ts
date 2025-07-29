import { Endpoints } from "../urls";
import { ChatIdResponse } from "../models/chat";
import { apiClient } from "../apis";

export const ChatServices = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number) => {
        try {
            const response = await apiClient.get(
                Endpoints.HISTORY + `/${chat_id}?page=${page}&page_size=${page_size}`,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getChatId: async (user_id: number, persona_id: string): Promise<ChatIdResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.CHAT,
                {
                    "user_id": user_id,
                    "persona_id": persona_id
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }
})