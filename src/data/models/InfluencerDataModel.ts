// export interface InfluencerDataModel {
//     id: string;
//     username: string;
//     name: string;
//     img?: string;
//     bio?: string;
//     videoUrl?: string;
//     prompt_template?: string;
//     daily_scripts?: string[];
// }
export interface InfluencerDataModel {
    id: string;
    img: string;
    videoUrl?: string;
    username: string;
    name: string;
    bio?: string;
    created_at: string;
    earnings: number;
    isSelected: boolean;
    voice_id?: string;
    prompt_template?: string;
    daily_scripts?: string[];
    influencer_agent_id_third_part?: string;
    bio_json?: string;
    social_connections?: {
        instagram: boolean;
        facebook: boolean;
        onlyfans: boolean;
        twitter: boolean;
    };
}

export interface KnowledgeFileModel {
    id: number;
    filename: string;
    file_type: string;
    file_size_bytes: number;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}
