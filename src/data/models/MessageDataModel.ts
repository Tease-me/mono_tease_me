export interface Message {
    id: number;
    sender: "sent" | "received";
    text: string;
    time: string;
}