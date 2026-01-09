export interface UserDetailResponse {
    id: number;
    full_name?: string;
    username?: string;
    email: string;
    is_varified: boolean;
    profile_photo_url?: string;
}