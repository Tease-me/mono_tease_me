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

export interface ChatAudioResponse {
    ai_text: string;
    ai_audio_url: string;
    user_audio_url: string;
    transcript: string;
};

export interface SignedUrlResponse {
    signed_url: string;
    greeting_used: string;
    agent_id: string;
    credits_remainder_secs: number;
    first_message: string;
}
