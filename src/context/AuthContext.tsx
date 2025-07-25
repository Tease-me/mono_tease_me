import { GetUserDerails, Login, RefreshToken } from "@/api/apis";
import { mock } from "@/api/mock/mock";
import { TokenResponse } from "@/api/models/TokenResponse";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { UserDataModel } from "@/data/models/UserDataModel";
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
                    const tokens: TokenResponse = await RefreshToken(token)
                    storage.set(LocalStorageKeys.AccessToken, tokens.access_token)
                    storage.set(LocalStorageKeys.RefreshToken, tokens.refresh_token)
                    getUserDetails(tokens.access_token)
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

    const getUserDetails = async (access_token: string) => {
        const response = await GetUserDerails(access_token)
        const user: UserDataModel = {
            id: response.id,
            username: response.username,
            email: response.email,
            name: "Kako",
            createdAt: mock.getRandomDate(),
            updatedAt: mock.getRandomDate()
        }
        storage.setObject(LocalStorageKeys.AuthUser, user)
        setUser(user);
    }

    const login = async (email: string, password: string) => {
        setLoadingAuth(true);
        try {
            const response = await Login(email, password);
            if (response) {
                getUserDetails(response.access_token);
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
