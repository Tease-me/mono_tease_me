export const LocalStorageKeys = {
    AccessToken: 'access_token',
    RefreshToken: 'refresh_token',
    AuthUser: 'auth_user',
} as const;

export type LocalStorageKeys = typeof LocalStorageKeys[keyof typeof LocalStorageKeys];