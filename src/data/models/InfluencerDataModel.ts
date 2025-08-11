export interface InfluencerDataModel {
    id: string;
    username: string;
    name: string;
    img?: string;
    bio?: string;
    videoUrl?: string;
    prompt_template?: string;
    daily_scripts?: string[];
}