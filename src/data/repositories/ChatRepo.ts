import { ChatServices } from "@/api/services/ChatServices";
import { MessagePagination } from "../models/MessageDataModel";
import { ChatHistoryResponse, ChatIdResponse } from "@/api/models/chat";
import { sortAndMapMessages } from "@/api/maps/chat_maps";

const chatServices = ChatServices();

export const ChatRepository = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number): Promise<MessagePagination> => {
        var totalMessages = 0;
        try {
            const response: ChatHistoryResponse = await chatServices.getChatHistory(chat_id, page, page_size);
            const sortedMessages = sortAndMapMessages(response.messages)
            totalMessages = response.total;
            return {
                page: page,
                page_size: page_size,
                total: totalMessages,
                messages: sortedMessages
            };
        } catch (e) {
            throw e;
        }
    },
    getChatId: async (user_id: number, persona_id: string): Promise<string> => {
        const response: ChatIdResponse = await chatServices.getChatId(user_id, persona_id)
        return response.chat_id;
    }
})