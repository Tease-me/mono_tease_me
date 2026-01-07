export interface UserDetailResponse {
    id: number;
    name?: string;
    username?: string;
    email: string;
    is_varified: boolean;
    profile_photo_url?: string;
}