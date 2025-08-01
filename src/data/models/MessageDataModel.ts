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
    time: string;
    attachments?: MediaAttachment[];
}

export interface MessagePagination {
    total: number;
    page: number;
    page_size: number;
    messages: Message[];
}