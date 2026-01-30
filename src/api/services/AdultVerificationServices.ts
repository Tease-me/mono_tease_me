import { Endpoints } from "../urls";
import { apiClient } from "../apis";


export const startVerificationSession = async () => {

  const response = await apiClient.post(Endpoints.verification.session, "kyc");
  return response.data;
}

export const getVerificationSessionStatus = async (sessionId: string) => {
  const response = await apiClient.get(Endpoints.verification.sessionStatus(sessionId));
  return response.data;
};

export const completeVerificationSession = async (sessionId: string) => {
  const response = await apiClient.post(Endpoints.verification.sessionComplete(sessionId));
  return response.data;
};


export const getVerificationStatus = async () => {
  const response = await apiClient.get(Endpoints.verification.status)
  return response.data;
}


export const getVerificationHistory = async () => {
  const response = await apiClient.get(Endpoints.verification.history)
  return response.data;
}


export const verificationWebhook = async () => {
  const response = await apiClient.get(Endpoints.verification.webhook)
  return response.data;
}

