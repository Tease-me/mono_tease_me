import { apiClient } from "@/api/apis";
import { UserDetailResponse } from "@/api/models/user";
import { UserDataModel } from "../models/UserDataModel";
import { mock } from "@/api/mock/mock";
import { UserServices } from "@/api/services/UserServices";
import { faker } from "@faker-js/faker";
import dummy from "@/dummy/dummy";

const userServices = UserServices(apiClient);


export const UserRepo = () => ({
    getUserDerails: async (): Promise<UserDataModel> => {
        const response: UserDetailResponse = await userServices.getUserDetails()
        // TODO: Remove defaults when Profile is comming from backend
        const user: UserDataModel = {
            id: response.id,
            username: response.username,
            email: response.email,
            full_name: response.full_name,
            is_verified: response.is_varified,
            verification_required: response.verification_required,
            imgUrl: response.profile_photo_url,
            first_time_login: false,
            createdAt: mock.getRandomDate(),
            updatedAt: mock.getRandomDate()
        }

        return user;
    },
    getTopUserSpend: async (): Promise<UserDataModel[]> => {
        const count = 5;

        const imgs = await Promise.all(
            Array.from({ length: count }, () => dummy.image.getRandomMaleProfilePictures())
        );

        const users: UserDataModel[] = imgs.map((imgUrl) => {
            const first = faker.person.firstName('male');
            const last = faker.person.lastName();
            const name = `${first} ${last}`;
            const base = `${first}.${last}`.toLowerCase().replace(/[^a-z]/g, "");
            const username = `${base}${faker.number.int({ min: 100, max: 999 })}`;

            return {
                id: faker.number.int({ min: 1, max: 10_000_000 }),
                username,
                email: faker.internet.email().toLowerCase(),
                name,
                is_verified: faker.datatype.boolean(),
                imgUrl,
                first_time_login: false,
                createdAt: mock.getRandomDate(),
                updatedAt: mock.getRandomDate(),
            } as UserDataModel;
        });

        return users;
    }
})