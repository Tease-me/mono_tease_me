import { ChatServices } from "@/api/services/ChatServices";
import { Message, MessagePagination } from "../models/MessageDataModel";
import { ChatHistoryResponse, ChatIdResponse, SignedUrlResponse } from "@/api/models/chat";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";

const chatServices = ChatServices();

export const ChatRepository = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number): Promise<MessagePagination> => {
        var totalMessages = 0;
        try {
            const response: ChatHistoryResponse = await chatServices.getChatHistory(chat_id, page, page_size);
            totalMessages = response.total;
            const responseMessages: Message[] = response.messages.sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ).map(item => {
                const message: Message = {
                    id: item.id,
                    sender: item.sender === 'ai' ? "received" : "sent",
                    text: item.content,
                    time: formatDateTimeRelative(item.created_at),
                }
                if (item.audio_url != null) {
                    message.attachments = [
                        { audioUrl: item.audio_url, type: "audio" }
                    ]
                }
                return message;
            })
            return {
                page: page,
                page_size: page_size,
                total: totalMessages,
                messages: responseMessages
            };
        } catch (e) {
            throw e;
        }
    },
    getChatId: async (user_id: number, persona_id: string): Promise<string> => {
        const response: ChatIdResponse = await chatServices.getChatId(user_id, persona_id)
        return response.chat_id;
    },
    getSignedUrl: async (influencer_id: string): Promise<string> => {
        const response: SignedUrlResponse = await chatServices.getSignedUrl(influencer_id)
        return response.signed_url
    }
})