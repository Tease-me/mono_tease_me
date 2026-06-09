import { Message, MessagePagination } from "../models/MessageDataModel";
import { ChatAudioResponse, ChatHistoryResponse, ChatIdResponse } from "@/api/models/chat";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";
import { AdultChatServices } from "@/api/services/AdultChatServices";

const chatServices = AdultChatServices();

export const AdultChatRepo = () => ({
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
                    channel: item.channel ?? "chat",
                    text: item.content,
                    callId: item.conversation_id ?? item.chat_id,
                    time: formatDateTimeRelative(item.created_at),
                    timestamp: new Date(item.created_at).getTime(),
                }

                if (item.audio_url != null) {
                    message.attachments = [
                        { audioUrl: item.audio_url, type: "audio" }
                    ]
                    message.transcript = item.content || undefined;
                    message.text = undefined
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
    sendAudioMessage: async (audioBlob: Blob, influencer_id: string, chat_id: string) => {
        const response: ChatAudioResponse = await chatServices.postAudioMessage(audioBlob, influencer_id, chat_id);
        return {
            audio_url: response.ai_audio_url,
            transcript: response.transcript,
            ai_text: response.ai_text,
        }
    }
})
