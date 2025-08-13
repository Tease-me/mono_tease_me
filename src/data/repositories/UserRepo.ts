import { apiClient } from "@/api/apis";
import { UserDetailResponse } from "@/api/models/user";
import { UserDataModel } from "../models/UserDataModel";
import { mock } from "@/api/mock/mock";
import { UserServices } from "@/api/services/UserServices";
import dummy from "@/dummy/dummy";

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
    },
    getTopUserSpend: async (): Promise<UserDataModel[]> => {
        const count = 5;

        const imgs = await Promise.all(Array.from({ length: count }, () => dummy.getRandomImages()))

        const users: UserDataModel[] = imgs.map((imgUrl) => {
            const name = dummy.getRandomMaleFirstName();
            const username = dummy.makeUsername(name);
            return {
                id: 1,
                username,
                email: `${username}@example.com`,
                name,
                is_verified: true,
                imgUrl,
                first_time_login: false,
                createdAt: mock.getRandomDate(),
                updatedAt: mock.getRandomDate(),
            } as UserDataModel;
        });

        return users;
    }
})