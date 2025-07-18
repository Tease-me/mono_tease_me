import { Message } from "./MessageDataModel";

export interface Contact {
    conversation_id: number;
    name: string;
    img: string;
    messages: Message[];
}