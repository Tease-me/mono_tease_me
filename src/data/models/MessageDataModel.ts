export type MediaType = 'image' | 'video' | 'audio' | 'file';

export interface MediaAttachment {
    type: MediaType;
    blob?: Blob;
    audioUrl?: string;
    thumbnailBlob?: Blob;
}

export interface Message {
    id: number;
    sender: 'sent' | 'received';
    text?: string;
    transcript?: string;
    time: string;
    attachments?: MediaAttachment[];
    channel?: string;
    timestamp?: number;
    callId?: string;
}

export interface MessagePagination {
    total: number;
    page: number;
    page_size: number;
    messages: Message[];
}
