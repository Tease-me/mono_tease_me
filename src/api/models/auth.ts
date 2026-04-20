export interface RegisterResponse {
    ok: boolean,
    message: string
}

export interface CompleteProfileResponse {
    ok: true;
    user_id: number;
    email: string;
    message: string;
}

export interface CheckTokenResponse {
    ok: true;
    valid: true;
    message: string;
}

export interface ForgotPasswordResponse {
    ok: boolean;
    message: string;
}

export interface ResendSurveyResponse {
    ok: boolean;
    username?: string;
    email?: string;
    message: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
}

export interface VerifyEmailResponse extends TokenResponse {
    ok: boolean;
    message: string;
}
