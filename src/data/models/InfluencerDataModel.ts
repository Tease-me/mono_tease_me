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
    joinedDate: string;
    earnings: number;
    isSelected: boolean;
    voice_id?: string;
    prompt_template?: string;
    daily_scripts?: string[];
    elevenlabs_agent_id?: string;
    voice_prompt?: string;
    social_connections?: {
        instagram: boolean;
        facebook: boolean;
        onlyfans: boolean;
        twitter: boolean;
    };
}
