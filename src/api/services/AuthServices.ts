import { AxiosInstance } from "axios";
import {
  CheckTokenResponse,
  CompleteProfileResponse,
  ForgotPasswordResponse,
  RegisterResponse,
  TokenResponse,
} from "../models/auth";
import { Endpoints } from "../urls";

type CompleteProfileParams = {
  token: string;
  password: string;
  email?: string | null;
  influencer_id?: string | null;
  full_name?: string | null;
  user_name?: string | null;
  profile_photo_url?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  file?: File | null;
  fp_tid?: string | null;
  invite_code?: string | null;
};

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
  checkToken: async (token: string): Promise<CheckTokenResponse> => {
    try {
      const response = await apiClient.post<CheckTokenResponse>(
        Endpoints.auth.checkToken,
        { token },
      );
      return response.data;
    } catch (error: any) {
      throw {
        status: error?.response?.status,
        detail: error?.response?.data?.detail,
      };
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
  completeProfile: async ({
    token,
    password,
    email,
    influencer_id,
    full_name,
    user_name,
    profile_photo_url,
    gender,
    date_of_birth,
    file,
    fp_tid,
    invite_code,
  }: CompleteProfileParams): Promise<CompleteProfileResponse> => {
    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("password", password);
      if (email) formData.append("email", email);
      if (influencer_id) formData.append("influencer_id", influencer_id);
      if (full_name) formData.append("full_name", full_name);
      if (user_name) formData.append("user_name", user_name);
      if (profile_photo_url) formData.append("profile_photo_url", profile_photo_url);
      if (gender) formData.append("gender", gender);
      if (date_of_birth) formData.append("date_of_birth", date_of_birth);
      if (file) formData.append("file", file);
      if (fp_tid) formData.append("fp_tid", fp_tid);
      if (invite_code) formData.append("invite_code", invite_code);

      const response = await apiClient.post<CompleteProfileResponse>(
        Endpoints.auth.completeProfile,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          }
        },
      );
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
