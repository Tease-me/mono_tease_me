import { apiClient } from "@/api/apis";
import { TokenResponse } from "@/api/models/auth";
import { AuthServices } from "@/api/services/AuthServices";
import { PushNotificationServices } from "@/api/services/PushNotificationServices";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { UserDataModel } from "@/data/models/UserDataModel";
import { UserRepo } from "@/data/repositories/UserRepo";
import { FIREBASE_PUBLIC_KEY } from "@/env";
import { useNotificationSocket, NotificationEvent } from "@/hooks/useNotificationSocket";
import logger from "@/utils/logger";
import { storage } from "@/utils/storage";

import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePostHog } from "@posthog/react";

export interface AuthContextType {
    accessToken?: string;
    loadingAuth: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
    logout: (callback?: () => void) => void;
    refreshUser: () => Promise<void>;
    authErrors?: AuthErrors;
    isSignedIn: boolean;
    user?: UserDataModel;
}

export interface AuthErrors {
    data: {
        error: string;
        status: number;
    };
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>(
    {} as AuthContextType
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const posthog = usePostHog();
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [authErrors, setAuthErrors] = useState<AuthErrors>();
    const [user, setUser] = useState<UserDataModel | undefined>();

    const authServices = useMemo(() => AuthServices(apiClient), []);
    const userRepo = useMemo(() => UserRepo(), []);
    const pusnNotificationServices = useMemo(() => PushNotificationServices(apiClient), []);

    const clearAuthStorage = useCallback(() => {
        storage.remove(LocalStorageKeys.AccessToken);
        storage.remove(LocalStorageKeys.RefreshToken);
        storage.remove(LocalStorageKeys.AuthUser);
        setUser(undefined);
        setIsSignedIn(false);
    }, []);

    useEffect(() => {
        if (authErrors) {
            const timeout = setTimeout(() => {
                setAuthErrors(undefined);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [authErrors]);

    useEffect(() => {
        if (isSignedIn) {
            (async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    let subscription = await registration.pushManager.getSubscription();
                    if (!subscription) {
                        subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: FIREBASE_PUBLIC_KEY
                        });
                    }
                    logger.info('Successfully subscribed in the front end! 🎉', subscription);
                    await pusnNotificationServices.subscribe(subscription);
                    logger.info('Successfully subscribed in the backend end! 🎉');
                } catch (error) {
                    logger.error('Service worker not ready or push subscription failed:', error);
                }
            })();
        }
    }, [isSignedIn, pusnNotificationServices]);

    // ── Notification WebSocket ──────────────────────────────────
    const handleNotification = useCallback((event: NotificationEvent) => {
        logger.info("[NotificationSocket] event:", event.type);
        // Re-broadcast as DOM CustomEvent so any component can react
        window.dispatchEvent(new CustomEvent("ws:notification", { detail: event }));
    }, []);

    useNotificationSocket(
        isSignedIn ? user?.email : undefined,
        handleNotification,
    );

    const getUserDetails = useCallback(async () => {
        const user: UserDataModel = await userRepo.getUserDerails()
        storage.setObject(LocalStorageKeys.AuthUser, user)
        setUser(user);
    }, [userRepo]);

    const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string) => {
        try {
            storage.set(LocalStorageKeys.AccessToken, accessToken);
            storage.set(LocalStorageKeys.RefreshToken, refreshToken);
            await getUserDetails();
            setIsSignedIn(true);
        } catch (error) {
            clearAuthStorage();
            throw error;
        }
    }, [clearAuthStorage, getUserDetails]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = storage.get(LocalStorageKeys.RefreshToken);
                if (token) {
                    const tokens: TokenResponse = await authServices.refreshToken(token)
                    await loginWithTokens(tokens.access_token, tokens.refresh_token);
                } else {
                    setIsSignedIn(false);
                }
            } catch {
                clearAuthStorage();
            } finally {
                setLoadingAuth(false);
            }
        };
        checkAuth();
    }, [authServices, clearAuthStorage, loginWithTokens]);

    const login = async (email: string, password: string) => {
        try {
            const response = await authServices.login(email, password);
            if (response) {
                await loginWithTokens(response.access_token, response.refresh_token);
                posthog?.identify(email);
                posthog?.capture("user_logged_in");
                return true;
            }
            return false;
        } catch (error: any) {
            setAuthErrors({
                data: {
                    error: error?.detail || "An error occurred during login",
                    status: error?.status || 500,
                },
            });
            return false;
        }
    };

    const logout = async (callback?: () => void) => {
        posthog?.capture("user_logged_out");
        posthog?.reset();
        setIsSignedIn(false);
        const disclaimerSeen = storage.get(LocalStorageKeys.DisclaimerSeen);
        storage.clear();
        if (disclaimerSeen) storage.set(LocalStorageKeys.DisclaimerSeen, disclaimerSeen);
        callback?.();
    }

    return (
        <AuthContext.Provider
            value={{
                login: login,
                loginWithTokens: loginWithTokens,
                loadingAuth: loadingAuth,
                logout: logout,
                refreshUser: getUserDetails,
                isSignedIn: isSignedIn,
                authErrors: authErrors,
                user: user
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
