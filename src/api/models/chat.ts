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
    conversation_id?: string;
    content: string;
    audio_url: string;
    channel?: string;
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
}

export interface ConversationTokenResponse {
    token: string;
    agent_id: string;
    credits_remainder_secs: number;
    greeting_used?: string;
    prompt?: string;
    native_language?: string;
}

export interface CallTranscriptEntryResponse {
    sender: string;
    text: string;
    time_in_call_secs: number;
}

export interface CallDetailsResponse {
    conversation_id: string;
    user_id: number;
    influencer_id: string;
    chat_id: string;
    status: string;
    duration_seconds: number;
    transcript: CallTranscriptEntryResponse[];
    created_at: string;
    agent_id: string | null;
}
