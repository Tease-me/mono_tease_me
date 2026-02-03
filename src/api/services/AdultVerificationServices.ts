import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const AdultVerificationSerivces = (apiClient: AxiosInstance) => ({
  startVerificationSession: async () => {
    const response = await apiClient.post(Endpoints.verification.session, {
      workflow_type: "kyc",
    });
    return response.data;
  },
  getVerificationSessionStatus: async (sessionId: string) => {
    const response = await apiClient.get(Endpoints.verification.sessionStatus(sessionId));
    return response.data;
  },
  completeVerificationSession: async (sessionId: string) => {
    const response = await apiClient.post(Endpoints.verification.sessionComplete(sessionId));
    return response.data;
  },
  getVerificationStatus: async () => {
    const response = await apiClient.get(Endpoints.verification.status)
    return response.data;
  },
  getVerificationHistory: async () => {
    const response = await apiClient.get(Endpoints.verification.history)
    return response.data;
  },
  verificationWebhook: async () => {
    const response = await apiClient.get(Endpoints.verification.webhook)
    return response.data;
  }
});
