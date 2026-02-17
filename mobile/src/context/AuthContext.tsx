import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { router } from 'expo-router';
import { authAPI, setAuthToken, getAuthToken, removeAuthToken } from '../services/api';
import { authEvents } from '../services/authEvents';
import { useOfflineStore } from '../stores/offlineStore';

// Types
export type UserRole = 'member' | 'trainer' | 'manager';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    gym_id: string;
    gym_name?: string;
    xp_points: number;
    avatar_url?: string;
    username?: string;
    onboarding_completed: boolean;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<User | undefined>;
    register: (email: string, password: string, name: string, gymCode: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    devLogin: () => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    googleSignIn: (token: string) => Promise<void>;
    completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ... (state)

    // ... (checkAuth)

    // ... (login)

    const devLogin = async () => {
        try {
            const { token, user } = await authAPI.devLogin();
            await setAuthToken(token);

            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
        } catch (error: any) {
            throw new Error(error.message || 'Dev Login failed');
        }
    };

    // Removed duplicate register function

    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isLoading: true,
        isAuthenticated: false,
    });

    // Check for existing token on mount
    useEffect(() => {
        checkAuth();

        // Listen for global logout events (e.g. from 401 interceptor)
        const unsubscribe = authEvents.subscribe(() => {
            console.log('[AuthContext] Received global logout event');
            logout();
        });

        return () => unsubscribe();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await getAuthToken();
            console.log('[AuthContext] checkAuth - Token found:', token ? 'Yes' : 'No');

            if (token) {
                console.log('[AuthContext] Verifying token with getMe()...');
                const { user } = await authAPI.getMe();
                console.log('[AuthContext] Token verified. User:', user?.email);
                setState({
                    user,
                    token,
                    isLoading: false,
                    isAuthenticated: true,
                });
            } else {

                setState({
                    user: null,
                    token: null,
                    isLoading: false,
                    isAuthenticated: false,
                });
            }
        } catch (error) {
            // Token invalid or expired
            await removeAuthToken();
            setState({
                user: null,
                token: null,
                isLoading: false,
                isAuthenticated: false,
            });
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const { token, user } = await authAPI.login({ email, password });
            await setAuthToken(token);

            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
            return user;
        } catch (error: any) {
            throw new Error(error.message || 'Login failed');
        }
    };

    const register = async (email: string, password: string, name: string, gymCode: string) => {
        try {
            const { token, user } = await authAPI.register({
                email,
                password,
                name,
                gym_code: gymCode,
            });
            await setAuthToken(token);

            // Initialize offline store
            useOfflineStore.getState().setOnline(true);

            setState({
                user: {
                    ...user,
                    onboarding_completed: user.onboarding_completed ?? false
                },
                token,
                isLoading: false,
                isAuthenticated: true,
            });
        } catch (error: any) {
            console.error('Registration Error:', error);
            throw new Error(error.message || 'Registration failed');
        }
    };


    const logout = async () => {
        await removeAuthToken();
        setState({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
        });
        // Navigate to login page
        router.replace('/login');
    };

    const googleSignIn = async (idToken: string) => {
        try {
            const { token, user } = await authAPI.googleLogin(idToken);
            await setAuthToken(token);

            // Initialize offline store
            useOfflineStore.getState().setOnline(true);

            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
        } catch (error: any) {
            throw new Error(error.message || 'Google Sign-In failed');
        }
    };

    const forgotPassword = async (email: string) => {
        return authAPI.forgotPassword(email);
    };

    const refreshUser = async () => {
        try {
            const { user } = await authAPI.getMe();
            setState((prev) => ({ ...prev, user }));
        } catch (error) {
            // If refresh fails, logout
            await logout();
        }
    };

    return (
        <AuthContext.Provider
            value={{
                ...state,
                login,
                register,
                logout,
                refreshUser,
                googleSignIn,
                forgotPassword,
                devLogin,
                completeOnboarding: () => setState(prev => prev.user ? ({
                    ...prev,
                    user: { ...prev.user, onboarding_completed: true }
                }) : prev)
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
