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
    user_name: string,
    date_of_birth: string,
    file?: File | null,
    invite_code?: string | null,
    profile_photo_url?: string | null
  ): Promise<RegisterResponse> => {
    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("email", email);
      if (influencer_id) formData.append("influencer_id", influencer_id);
      formData.append("full_name", full_name);
      formData.append("gender", gender);
      formData.append("user_name", user_name);
      formData.append("date_of_birth", date_of_birth);
      if (file) {
        formData.append("file", file);
      } else if (profile_photo_url) {
        formData.append("profile_photo_url", profile_photo_url);
      }
      if (invite_code) formData.append("invite_code", invite_code);
      const response = await apiClient.post(Endpoints.auth.register, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data || error;
    }
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
