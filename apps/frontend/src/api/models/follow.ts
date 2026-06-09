export interface FollowStatus {
    influencer_id: string;
    user_id: number;
    following: boolean;
    created_at: string;
}

export interface FollowActionResponse extends FollowStatus { }

export interface FollowListResponse {
    count: number;
    items: FollowStatus[];
}
