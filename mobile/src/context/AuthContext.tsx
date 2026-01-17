import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, setAuthToken, getAuthToken, removeAuthToken } from '../services/api';
import { authEvents } from '../services/authEvents';

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
    googleSignIn: (idToken: string) => Promise<User | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
        } catch (error: any) {
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
    };

    const googleSignIn = async (idToken: string) => {
        try {
            // In a real app, you would send this token to your backend
            // const { token, user } = await authAPI.googleLogin(idToken);

            // For MVP/Demo without backend Google setup:
            // logic to simulate or just decode on backend
            const { token, user } = await authAPI.login({ email: 'demo@fitzo.app', password: 'password123' }); // Fallback for demo

            //Ideally:
            // const res = await fetch('YOUR_BACKEND/api/auth/google', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ token: idToken })
            // });

            await setAuthToken(token);
            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
            return user;
        } catch (error: any) {
            throw new Error(error.message || 'Google Sign-In failed');
        }
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
