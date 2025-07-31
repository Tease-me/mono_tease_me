export interface RegisterResponse {
    ok: boolean,
    message: string
}

export interface ForgotPasswordResponse {
    ok: boolean;
    message: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
}