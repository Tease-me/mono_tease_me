import { AxiosInstance } from "axios";
import {
  ForgotPasswordResponse,
  RegisterResponse,
  ResendSurveyResponse,
  TokenResponse,
} from "../models/auth";
import { Endpoints } from "../urls";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

type JoinAttribution = {
  fpr?: string;
  inviteCode?: string;
  inviteeEmail?: string;
  inviterEmail?: string;
  accountManagerEmail?: string;
};

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
      const searchParams = new URLSearchParams(window.location.search);
      const storedJoinAttribution =
        storage.getObject<JoinAttribution>(LocalStorageKeys.JoinAttribution) ??
        {};
      const parent_ref_id =
        searchParams.get("fpr") ??
        storedJoinAttribution.fpr ??
        storage.get(LocalStorageKeys.ParentRefId);
      const invite_code =
        searchParams.get("inviteCode") ?? storedJoinAttribution.inviteCode;
      const invitee_email =
        searchParams.get("inviteeEmail") ?? storedJoinAttribution.inviteeEmail;
      const inviter_email =
        searchParams.get("inviterEmail") ?? storedJoinAttribution.inviterEmail;
      const account_manager_email =
        searchParams.get("accountManagerEmail") ??
        storedJoinAttribution.accountManagerEmail;

      if (parent_ref_id) {
        storage.set(LocalStorageKeys.ParentRefId, parent_ref_id);
      }
      if (
        parent_ref_id ||
        invite_code ||
        invitee_email ||
        inviter_email ||
        account_manager_email
      ) {
        storage.setObject(LocalStorageKeys.JoinAttribution, {
          fpr: parent_ref_id ?? undefined,
          inviteCode: invite_code ?? undefined,
          inviteeEmail: invitee_email ?? undefined,
          inviterEmail: inviter_email ?? undefined,
          accountManagerEmail: account_manager_email ?? undefined,
        });
      }
      const response = await apiClient.post(
        Endpoints.pre_influencers.register,
        {
          ...payload,
          parent_ref_id,
          invite_code,
          invitee_email,
          inviter_email,
          account_manager_email,
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
        Endpoints.pre_influencers.refreshToken,
        null,
        {
          params: {
            refresh_token: refreshToken,
          },
        },
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
        },
      );

      return data;
    } catch (err: any) {
      throw err;
    }
  },

  resendSurvey: async (identifier: string) => {
    try {
      const { data } = await apiClient.post<ResendSurveyResponse>(
        Endpoints.pre_influencers.resendSurvey,
        null,
        {
          params: {
            identifier,
          },
        },
      );

      return data;
    } catch (err: any) {
      throw err;
    }
  },
});
