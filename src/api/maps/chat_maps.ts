import { Message } from "@/data/models/MessageDataModel";
import { MessageResponse } from "../models/chat";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";

export function sortAndMapMessages(messages: MessageResponse[]): Message[] {
    const responseMessages: Message[] = messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ).map(item => {
        return {
            id: item.id,
            sender: item.sender === 'ai' ? "received" : "sent",
            text: item.content,
            time: formatDateTimeRelative(item.created_at)
        }
    })
    return responseMessages;
}