import { Message } from "./MessageDataModel";

export interface Contact {
    conversation_id: string;
    name: string;
    img: string;
    messages: Message[];
}