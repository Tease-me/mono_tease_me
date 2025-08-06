import { Endpoints } from "../urls";
import { ForgotPasswordResponse, RegisterResponse, TokenResponse } from "../models/auth";
import { AxiosInstance } from "axios";

export const AuthServices = (apiClient: AxiosInstance) => ({
    login: async (email: string, password: string): Promise<TokenResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.auth.login,
                { email, password },
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    register: async (password: string, email: string): Promise<RegisterResponse> => {
        try {
            const response = await apiClient.post(
                Endpoints.auth.register,
                {
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
                Endpoints.auth.refreshToken,
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
    },
    forgotPassword: async (email: string) => {
        try {
            const { data } = await apiClient.post<ForgotPasswordResponse>(Endpoints.auth.forgotPassword,
                null,
                {
                    params: {
                        email: email
                    }
                }
            );

            return data;
        } catch (err: any) {
            throw err
        }
    }

})