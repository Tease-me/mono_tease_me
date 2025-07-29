import axios from 'axios';
import { API_BASE_URL } from './urls';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10_000,
    headers: { 'ngrok-skip-browser-warning': 'true' }
});

apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers!['Authorization'] = `Bearer ${token}`;
    return config;
});

apiClient.interceptors.response.use(
    r => r,
    async err => {
        if (err.response?.status === 401) {
            // try token refresh, or redirect to login
        }
        return Promise.reject(err);
    }
);