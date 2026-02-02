import { AxiosInstance } from "axios";
import {
  ForgotPasswordResponse,
  RegisterResponse,
  TokenResponse,
} from "../models/auth";
import { Endpoints } from "../urls";

export const AuthServices = (apiClient: AxiosInstance) => ({
  login: async (email: string, password: string): Promise<TokenResponse> => {
    try {
      const response = await apiClient.post(Endpoints.auth.login, {
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },
  register: async (
    password: string,
    email: string,
    influencer_id: string,
    full_name: string,
    gender: string,
    date_of_birth: string
  ): Promise<RegisterResponse> => {
    const response = await apiClient.post(Endpoints.auth.register, {
      password,
      email,
      influencer_id: influencer_id,
      full_name,
      gender,
      date_of_birth,
    });

    return response.data;
  },
  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    try {
      const response = await apiClient.post(Endpoints.auth.refreshToken, null, {
        params: {
          refresh_token: refreshToken,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  forgotPassword: async (email: string) => {
    try {
      const { data } = await apiClient.post<ForgotPasswordResponse>(
        Endpoints.auth.forgotPassword,
        null,
        {
          params: {
            email: email,
          },
        }
      );

      return data;
    } catch (err: any) {
      throw err;
    }
  },
});
