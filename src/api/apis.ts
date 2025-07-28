import axios from 'axios';
import { Endpoints } from './urls';
import { TokenResponse } from './models/TokenResponse';
import { UserDetailResponse } from './models/LoginResponse';
import { ChatIdResponse, ChatHistoryResponse } from './models/chat';

export const Login = async (email: string, password: string): Promise<TokenResponse> => {
    try {
        const response = await axios.post(
            Endpoints.LOGIN,
            { email, password },
        );
        return response.data;
    } catch (error) {
        throw error;
    }
};


export const Register = async (username: string, password: string, email: string): Promise<TokenResponse> => {
    try {
        const response = await axios.post(
            Endpoints.REGISTER,
            {
                "username": username,
                "password": password,
                "email": email
            },
        );
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const RefreshToken = async (refreshToken: string): Promise<TokenResponse> => {
    try {
        const response = await axios.post(
            Endpoints.REFRESH_TOKEN,
            null,
            {
                params: {
                    refresh_token: refreshToken
                }
            }
        );
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const GetUserDerails = async (access_token: string): Promise<UserDetailResponse> => {
    try {
        const response = await axios.get(
            Endpoints.ME,
            {
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "ngrok-skip-browser-warning": "true"
                }
            }
        );
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const GetChatId = async (user_id: number, persona_id: string): Promise<ChatIdResponse> => {
    try {
        const response = await axios.post(
            Endpoints.CHAT,
            {
                "user_id": user_id,
                "persona_id": persona_id
            }
        );
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const GetChatHistory = async (chat_id: string, page: number, page_size: number): Promise<ChatHistoryResponse> => {
    try {
        const response = await axios.get(
            Endpoints.HISTORY + `/${chat_id}?page=${page}&page_size=${page_size}`,
            {
                headers: {
                    "ngrok-skip-browser-warning": "true"
                }
            }
        );
        return response.data;
    } catch (error) {
        throw error;
    }
}