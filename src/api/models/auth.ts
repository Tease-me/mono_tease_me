export interface RegisterResponse {
  ok: boolean;
  message: string;
  user_id?: number;
  email?: string;
  token?: string;
  temp_password?: string;
  survey_step?: number;
  onboarding_url?: string;
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
  email: string;
  full_name: string | null;
  user_name: string | null;
  profile_photo_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
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
