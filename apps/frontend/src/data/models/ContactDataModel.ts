import { Message } from "./MessageDataModel";

export interface Contact {
    influencer_id: string;
    conversation_id: string;
    name: string;
    img: string;
    messages: Message[];
}