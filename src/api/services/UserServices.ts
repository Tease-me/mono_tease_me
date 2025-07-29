import { Endpoints } from "../urls";
import { apiClient } from "../apis";
import { UserDetailResponse } from "../models/LoginResponse";

export const UserServices = () => ({
    getUserDerails: async (): Promise<UserDetailResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.ME,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

})