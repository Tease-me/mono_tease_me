import { Endpoints } from "../urls";
import { UserDetailResponse } from "../models/user";
import { AxiosInstance } from "axios";

export const UserServices = (apiClient: AxiosInstance) => ({
    getUserDetails: async (): Promise<UserDetailResponse> => {
        try {
            const response = await apiClient.get(
                Endpoints.auth.me,
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

})