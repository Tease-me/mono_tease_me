import { Login } from "@/api/apis";
import { mock } from "@/api/mock/mock";
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
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
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
                const token = storage.get(LocalStorageKeys.AccessToken);
                const user = storage.getObject<UserDataModel>(LocalStorageKeys.AuthUser)
                setUser(user)
                if (user && token) {
                    setIsSignedIn(true);
                    setAccessToken(token);
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

    const login = async (email: string, password: string) => {
        setLoadingAuth(true);
        try {
            const response = await Login(email, password);
            if (response) {
                setIsSignedIn(true);
                setAccessToken(response.access_token);
                storage.set(LocalStorageKeys.AccessToken, response.access_token);
                const user: UserDataModel = {
                    id: response.user_id,
                    email: response.email,
                    name: "Kako",
                    createdAt: mock.getRandomDate(),
                    updatedAt: mock.getRandomDate()
                }
                storage.setObject(LocalStorageKeys.AuthUser, user)
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

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                login: login,
                loadingAuth: loadingAuth,
                logout: (callback?: () => void) => {
                    setIsSignedIn(false);
                    setAccessToken(undefined);
                    localStorage.removeItem("access_token");
                    if (callback) callback();
                },
                isSignedIn: isSignedIn,
                authErrors: authErrors,
                user: user
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
