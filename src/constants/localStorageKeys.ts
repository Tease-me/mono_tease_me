export const LocalStorageKeys = {
    AccessToken: 'access_token',
    RefreshToken: 'refresh_token',
    AuthUser: 'auth_user',
    VisitedWelcome: 'visited_welcome'
} as const;

export type LocalStorageKeys = typeof LocalStorageKeys[keyof typeof LocalStorageKeys];