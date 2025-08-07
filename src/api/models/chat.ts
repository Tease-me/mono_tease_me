export interface ChatIdResponse {
    chat_id: string;
}

export interface ChatHistoryResponse {
    total: number;
    page: number;
    page_size: number;
    messages: MessageResponse[]
}

export interface MessageResponse {
    id: number;
    chat_id: string;
    sender: string;
    content: string;
    audio_url: string;
    created_at: string;
}

export interface SignedUrlResponse {
    signed_url: string;
}