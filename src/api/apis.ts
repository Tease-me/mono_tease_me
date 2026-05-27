import axios from 'axios';
import { API_BASE_URL } from './urls';
import { showErrorModal } from '@/utils/errorModal';

declare module 'axios' {
    interface AxiosRequestConfig {
        skipAuth?: boolean;
    }

    interface InternalAxiosRequestConfig {
        skipAuth?: boolean;
    }
}

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30_000,
    headers: {
        'Content-Type': 'application/json',
    }
});

apiClient.interceptors.request.use(config => {
    if (config.skipAuth) return config;
    const token = localStorage.getItem('access_token');
    if (token) config.headers!['Authorization'] = `Bearer ${token}`;
    return config;
});

apiClient.interceptors.response.use(
    r => r,
    async err => {
        const status = err.response?.status;
        if (status === 401) {
            // try token refresh, or redirect to login
        }
        if (!status || status >= 500) {
            const message =
                err.response?.data?.message ||
                err.response?.data?.detail ||
                err.message ||
                "Server error. Please try again.";
            showErrorModal({
                title: "Server error",
                message,
                status,
            });
        }
        return Promise.reject(err);
    }
);
