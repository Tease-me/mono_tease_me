import { showErrorModal } from "@/utils/errorModal";
import axios from "axios";
import { API_BASE_URL } from "./urls";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
    skipErrorModal?: boolean;
  }

  interface InternalAxiosRequestConfig {
    skipAuth?: boolean;
    skipErrorModal?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (config.skipAuth) return config;
  const token = localStorage.getItem("access_token");
  if (token) config.headers!["Authorization"] = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.config?.skipErrorModal) {
      return Promise.reject(err);
    }

    const status = err.response?.status;
    if (status === 401) {
      // try token refresh, or redirect to login
    }
    if (!status || status >= 500) {
      const detail = err.response?.data?.detail;
      const detailMessage =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail
                .map((item) =>
                  typeof item === "object" && item && "msg" in item
                    ? String(item.msg)
                    : String(item),
                )
                .join(", ")
            : undefined;
      const message =
        err.response?.data?.message ||
        detailMessage ||
        err.message ||
        "Server error. Please try again.";
      showErrorModal({
        title: "Server error",
        message,
        status,
      });
    }
    return Promise.reject(err);
  },
);
