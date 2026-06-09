import { LoginBonusStatus } from "@/api/models/user";

export interface UserDataModel {
    id: number;
    full_name?: string;
    username?: string;
    email: string;
    imgUrl?: string;
    videoUrl?: string;
    phone?: string;
    bio?: string;
    is_verified: boolean;
    verification_required?: boolean;
    login_bonus_status?: LoginBonusStatus;
    first_time_login?: boolean;
    createdAt: string;
    updatedAt: string;
}
