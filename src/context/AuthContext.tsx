import { apiClient } from "@/api/apis";
import { mock } from "@/api/mock/mock";
import { TokenResponse } from "@/api/models/auth";
import { UserDetailResponse } from "@/api/models/user";
import { AuthServices } from "@/api/services/AuthServices";
import { PushNotificationServices } from "@/api/services/PushNotificationServices";
import { UserServices } from "@/api/services/UserServices";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { UserDataModel } from "@/data/models/UserDataModel";
import { FIREBASE_PUBLIC_KEY } from "@/env";
import { storage } from "@/utils/storage";

import React, { createContext, useState, useEffect } from "react";

export interface AuthContextType {
    accessToken?: string;
    loadingAuth: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: (callback?: () => void) => void;
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

export const AuthContext = createContext<AuthContextType>(
    {} as AuthContextType
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [authErrors, setAuthErrors] = useState<AuthErrors>();
    const [user, setUser] = useState<UserDataModel | undefined>()

    const authServices = AuthServices(apiClient);
    const userServices = UserServices(apiClient);
    const pusnNotificationServices = PushNotificationServices(apiClient);

    useEffect(() => {
        if (authErrors) {
            const timeout = setTimeout(() => {
                setAuthErrors(undefined);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [authErrors]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = storage.get(LocalStorageKeys.RefreshToken);
                if (token) {
                    const tokens: TokenResponse = await authServices.refreshToken(token)
                    storage.set(LocalStorageKeys.AccessToken, tokens.access_token)
                    storage.set(LocalStorageKeys.RefreshToken, tokens.refresh_token)
                    getUserDetails()
                    setIsSignedIn(true);
                } else {
                    setIsSignedIn(false);
                }
            } catch {
                setIsSignedIn(false);
            } finally {
                setLoadingAuth(false);
            }
        };
        checkAuth();
    }, []);

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
                    console.log('Successfully subscribed in the front end! 🎉', subscription);
                    await pusnNotificationServices.subscribe(subscription);
                    console.log('Successfully subscribed in the backend end! 🎉');
                } catch (error) {
                    console.error('Service worker not ready or push subscription failed:', error);
                }
            })();
        }
    }, [isSignedIn]);

    const getUserDetails = async () => {
        const response: UserDetailResponse = await userServices.getUserDerails()
        // Remove this when Profile is comming from backend
        const profileImage = await mock.getRandomProfileImage();
        const user: UserDataModel = {
            id: response.id,
            username: response.username,
            email: response.email,
            name: response.name,
            is_verified: response.is_varified,
            imgUrl: profileImage,
            createdAt: mock.getRandomDate(),
            updatedAt: mock.getRandomDate()
        }
        storage.setObject(LocalStorageKeys.AuthUser, user)
        setUser(user);
    }

    const login = async (email: string, password: string) => {
        setLoadingAuth(true);
        try {
            const response = await authServices.login(email, password);
            if (response) {
                getUserDetails();
                setIsSignedIn(true);
                storage.set(LocalStorageKeys.AccessToken, response.access_token)
                storage.set(LocalStorageKeys.RefreshToken, response.refresh_token)
                return true;
            }
            return false;
        } catch (error: any) {
            setAuthErrors({
                data: {
                    error: error?.message || error.data.error || "An error occurred during login",
                    status: error?.status || 500,
                },
            });
            return false;
        } finally {
            setLoadingAuth(false);
        }
    };

    const logout = async (callback?: () => void) => {
        setIsSignedIn(false);
        storage.clear();
        callback?.();
    }

    return (
        <AuthContext.Provider
            value={{
                login: login,
                loadingAuth: loadingAuth,
                logout: logout,
                isSignedIn: isSignedIn,
                authErrors: authErrors,
                user: user
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
