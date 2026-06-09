import { Message } from "../models/MessageDataModel";

export const ChatStorage = () => {
    const storageKey = (chatId: string) => `chat_history_${chatId}`;

    const getChatHistory = (chatId: string): Message[] => {
        const data = localStorage.getItem(storageKey(chatId));
        return data ? JSON.parse(data) as Message[] : [];
    };

    const saveChatHistory = (chatId: string, messages: Message[]): void => {
        localStorage.setItem(storageKey(chatId), JSON.stringify(messages));
    };

    const appendChatMessage = (chatId: string, message: Message): void => {
        const history = getChatHistory(chatId);
        const uniqueHistory = history.filter(m => m.id !== message.id);
        saveChatHistory(chatId, [...uniqueHistory, message]);
    };

    const appendChatMessages = (chatId: string, messages: Message[]): void => {
        const history = getChatHistory(chatId);
        const incomingIds = messages.map(m => m.id);
        const uniqueHistory = history.filter(m => !incomingIds.includes(m.id));
        saveChatHistory(chatId, [...uniqueHistory, ...messages]);
    };

    const clearChatHistory = (chatId: string): void => {
        localStorage.removeItem(storageKey(chatId));
    };

    return {
        getChatHistory,
        saveChatHistory,
        appendChatMessage,
        appendChatMessages,
        clearChatHistory,
    };
};