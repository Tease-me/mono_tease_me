export interface RelationshipDataModel {
    user_id: number;
    influencer_id: string;
    trust: number;
    closeness: number;
    attraction: number;
    safety: number;
    state: string;
    sentiment_score: number;
    sentiment_delta: number;
    exclusive_agreed: boolean;
    girlfriend_confirmed: boolean;
    last_interaction_at: string | null;
    updated_at: string | null;
}