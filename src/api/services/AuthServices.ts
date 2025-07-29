import { Endpoints } from "../urls";
import { TokenResponse } from "../models/TokenResponse";
import { apiClient } from "../apis";

export const AuthServices = () => ({
    login: async (email: string, password: string): Promise<TokenResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.LOGIN,
                { email, password },
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    register: async (username: string, password: string, email: string): Promise<TokenResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.REGISTER,
                {
                    "username": username,
                    "password": password,
                    "email": email
                },
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.REFRESH_TOKEN,
                null,
                {
                    params: {
                        refresh_token: refreshToken
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

})