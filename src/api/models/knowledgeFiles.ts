export interface KnowledgeFile {
    id?: number;
    file_id?: number;
    filename: string;
    file_type: string;
    file_size_bytes: number;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    message?: string;
}
