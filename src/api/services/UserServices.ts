import { Endpoints } from "../urls";
import { UserDetailResponse } from "../models/user";
import { AxiosInstance } from "axios";

export const UserServices = (apiClient: AxiosInstance) => ({
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