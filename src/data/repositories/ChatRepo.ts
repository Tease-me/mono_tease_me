import { ChatServices } from "@/api/services/ChatServices";
import { ChatStorage } from "../storage/ChatStorage";
import { MessagePagination } from "../models/MessageDataModel";
import { ChatHistoryResponse } from "@/api/models/chat";
import { sortAndMapMessages } from "@/api/maps/chat_maps";

export const ChatRepository = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number): Promise<MessagePagination> => {
        const chatServices = ChatServices();
        const chatStorage = ChatStorage();
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
    }
})