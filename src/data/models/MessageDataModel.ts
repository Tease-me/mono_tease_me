export type MediaType = 'image' | 'video' | 'audio' | 'file';

export interface MediaAttachment {
    type: MediaType;
    blob: Blob;
    thumbnailBlob?: Blob;
}

export interface Message {
    id: number;
    sender: 'sent' | 'received';
    text?: string;
    time: string;
    attachments?: MediaAttachment[];
}