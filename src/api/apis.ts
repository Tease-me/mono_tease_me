import axios from 'axios';
import { Endpoints } from './urls';
import { LoginResponse } from './models/LoginResponse';

export const Login = async (email: string, password: string): Promise<LoginResponse> => {
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


export const Register = async (username: string, password: string, email: string): Promise<LoginResponse> => {
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

export const GetChatId = async (user_id: number, persona_id: string): Promise<LoginResponse> => {
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