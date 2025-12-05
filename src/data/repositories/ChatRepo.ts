import { ChatServices } from "@/api/services/ChatServices";
import { Message, MessagePagination } from "../models/MessageDataModel";
import { ChatAudioResponse, ChatHistoryResponse, ChatIdResponse, SignedUrlResponse } from "@/api/models/chat";
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
                    channel: item.channel ?? "chat",
                    text: item.content,
                    time: formatDateTimeRelative(item.created_at),
                    timestamp: new Date(item.created_at).getTime(),
                }
                if (item.audio_url != null) {
                    message.attachments = [
                        { audioUrl: item.audio_url, type: "audio" }
                    ]
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
    getSignedUrl: async (influencer_id: string, user_id: number, signal?: AbortSignal): Promise<any> => {
        const response: SignedUrlResponse = await chatServices.getSignedUrl(influencer_id, user_id, signal)
        return { signed_url: response.signed_url, credits_remainder_secs: response.credits_remainder_secs, first_message: response.greeting_used };
    },
    getFreeSignedUrl: async (influencer_id: string, signal?: AbortSignal): Promise<any> => {
        const response: SignedUrlResponse = await chatServices.getSignedUrlFree(influencer_id, signal)
        return { signed_url: response.signed_url, credits_remainder_secs: response.credits_remainder_secs, first_message: response.greeting_used };
    },
    getFreeSignedLandingUrl: async (signal?: AbortSignal): Promise<any> => {
        const response: SignedUrlResponse = await chatServices.getSignedLandingUrlFree(signal)
        return { signed_url: response.signed_url, credits_remainder_secs: response.credits_remainder_secs, first_message: response.greeting_used };
    },
    registerConversation: async (conversation_id: string, user_id: number, influencer_id: string, signal?: AbortSignal) => {
        await chatServices.registerConversation(conversation_id, user_id, influencer_id, signal);
    },
    sendAudioMessage: async (audioBlob: Blob, influencer_id: string, chat_id: string) => {
        const response: ChatAudioResponse = await chatServices.postAudioMessage(audioBlob, influencer_id, chat_id);
        return {
            audio_url: response.ai_audio_url
        }
    }
})
