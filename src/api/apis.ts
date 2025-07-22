import axios from 'axios';
import { Endpoints } from './urls';
import { LoginResponse } from './models/LoginResponse';

export const Login = async (username: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await axios.post(
            Endpoints.LOGIN,
            { username, password },
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
            { username, password, email },
        );
        return response.data;
    } catch (error) {
        throw error;
    }
};