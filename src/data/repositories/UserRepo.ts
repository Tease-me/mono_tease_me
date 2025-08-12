import { apiClient } from "@/api/apis";
import { UserDetailResponse } from "@/api/models/user";
import { UserDataModel } from "../models/UserDataModel";
import { mock } from "@/api/mock/mock";
import { UserServices } from "@/api/services/UserServices";

const userServices = UserServices(apiClient);

export const UserRepo = () => ({
    getUserDerails: async (): Promise<UserDataModel> => {
        const response: UserDetailResponse = await userServices.getUserDerails()
        // TODO: Remove defaults when Profile is comming from backend
        const profileImage = await mock.getRandomProfileImage();
        const user: UserDataModel = {
            id: response.id,
            username: response.username,
            email: response.email,
            name: response.name,
            is_verified: response.is_varified,
            imgUrl: profileImage,
            first_time_login: false,
            createdAt: mock.getRandomDate(),
            updatedAt: mock.getRandomDate()
        }

        return user;
    }
})