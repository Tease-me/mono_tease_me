export interface UserDataModel {
    id: number;
    name?: string;
    username?: string;
    email: string;
    imgUrl?: string;
    videoUrl?: string;
    phone?: string;
    bio?: string;
    is_verified: boolean;
    createdAt: string;
    updatedAt: string;
}