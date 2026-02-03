export const LocalStorageKeys = {
    AccessToken: 'access_token',
    RefreshToken: 'refresh_token',
    AuthUser: 'auth_user',
    VisitedWelcome: 'visited_welcome',
    ActiveSidebarItem: 'active_sidebar_item',
    PreferredChatMode: 'preferred_chat_mode',
    DisclaimerSeen: 'disclaimer_seen'
} as const;

export type LocalStorageKeys = typeof LocalStorageKeys[keyof typeof LocalStorageKeys];
