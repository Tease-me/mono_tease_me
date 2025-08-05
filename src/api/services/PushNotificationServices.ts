import { Endpoints } from "../urls";
import { UserDetailResponse } from "../models/user";
import { AxiosInstance } from "axios";

export const PushNotificationServices = (apiClient: AxiosInstance) => ({
    subscribe: async (subscription: PushSubscription): Promise<UserDetailResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.SUBSCRIBE_PUSH_NOTIFICATION,
                subscription
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }
})