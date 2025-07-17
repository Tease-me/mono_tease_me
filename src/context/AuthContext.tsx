import { Login } from "@/api/apis";
import { UserDataModel } from "@/data/models/UserDataModel";
import React, { createContext, useState, useEffect, useCallback } from "react";

export interface AuthContextType {
    accessToken?: string;
    loadingAuth: boolean;
    login: (username: string, password: string) => Promise<boolean>;
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
    const [authErrors, setAuthErrors] = useState<AuthErrors>();

    useEffect(() => {
        if (authErrors) {
            const timeout = setTimeout(() => {
                setAuthErrors(undefined);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [authErrors]);

    const login = async (username: string, password: string) => {
        setLoadingAuth(true);
        try {
            const response = await Login(username, password);

            if (response) {
                setIsSignedIn(true);
                localStorage.setItem("authToken", `Bearer ${response.access_token}`);
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
                login: login,
                loadingAuth: loadingAuth,
                logout: (callback?: () => void) => {
                    setIsSignedIn(false);
                    localStorage.removeItem("authToken");
                    if (callback) callback();
                },
                isSignedIn: isSignedIn,
                authErrors: authErrors
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
