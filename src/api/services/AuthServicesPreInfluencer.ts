import { AxiosInstance } from "axios";
import {
  ForgotPasswordResponse,
  RegisterResponse,
  TokenResponse,
} from "../models/auth";
import { Endpoints } from "../urls";

export const AuthServicesPreInfluencer = (apiClient: AxiosInstance) => ({
  login: async (email: string, password: string): Promise<TokenResponse> => {
    try {
      const response = await apiClient.post(Endpoints.pre_influencers.login, {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  register: async (payload: {
    full_name: string;
    location: string;
    username: string;
    email: string;
    password: string;
  }): Promise<RegisterResponse> => {
    try {
      const parent_ref_id =
        new URLSearchParams(window.location.search).get("fpr") ??
        localStorage.getItem("parent_ref_id");

      if (parent_ref_id) {
        localStorage.setItem("parent_ref_id", parent_ref_id);
      }
      const response = await apiClient.post(
        Endpoints.pre_influencers.register,
        {
          ...payload,
          parent_ref_id,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    try {
      const response = await apiClient.post(
        Endpoints.pre_influencers.refreshToken,
        null,
        {
          params: {
            refresh_token: refreshToken,
          },
        }
      );
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
