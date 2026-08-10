import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, setAuthToken, getAuthToken, removeAuthToken, wakeBackend } from '../services/api';
import { authEvents } from '../services/authEvents';
import { useOfflineStore } from '../stores/offlineStore';

/**
 * Last-known user profile, cached alongside the auth token.
 *
 * The token lives in SecureStore and is valid for 90 days, but a session also
 * needs a `user` object to render. Without a cache, a cold/unreachable backend
 * at launch left us with a valid token and no user — which previously got
 * "resolved" by deleting the token and forcing a re-login. We now fall back to
 * the cached profile and refresh it in the background instead.
 */
const USER_CACHE_KEY = 'fitzo_cached_user';

const cacheUser = async (user: User | null) => {
    try {
        if (user) await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
        else await AsyncStorage.removeItem(USER_CACHE_KEY);
    } catch {
        // Cache is an optimisation; never let it break auth.
    }
};

const readCachedUser = async (): Promise<User | null> => {
    try {
        const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
        return raw ? (JSON.parse(raw) as User) : null;
    } catch {
        return null;
    }
};

/** Only a genuine 401 means the session is dead. Everything else is transport. */
const isAuthFailure = (error: any) =>
    error?.status === 401 || error?.code === 'AUTH_REQUIRED';

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
    register: (email: string, password: string, name: string, gymCode: string, avatarUrl?: string | null) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    devLogin: () => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (email: string, code: string, password: string) => Promise<void>;
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
            await cacheUser(user);

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
            logout();
        });

        return () => unsubscribe();
    }, []);

    const checkAuth = async () => {
        const token = await getAuthToken();

        if (!token) {
            setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
            return;
        }

        try {
            // MUST be awaited. The backend is on Render's free tier, where a cold
            // start takes 30-50s. Firing this off unawaited meant getMe() raced a
            // sleeping server and usually lost.
            await wakeBackend();

            const { user } = await authAPI.getMe();
            await cacheUser(user);
            setState({ user, token, isLoading: false, isAuthenticated: true });
        } catch (error: any) {
            // Previously this deleted the token on ANY error. Because a cold
            // backend or a flaky connection throws here, a perfectly valid
            // 90-day token was being wiped on launch — that is what made people
            // log in over and over. Only a real 401 ends the session now.
            if (isAuthFailure(error)) {
                await removeAuthToken();
                await cacheUser(null);
                setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
                return;
            }

            // Transport failure: keep the token, restore the last known profile
            // and let individual requests retry.
            const cached = await readCachedUser();
            if (cached) {
                useOfflineStore.getState().setOnline(false);
                setState({ user: cached, token, isLoading: false, isAuthenticated: true });
            } else {
                // No cached profile to render, so we cannot enter the app — but
                // we still keep the token so the next launch can recover.
                setState({ user: null, token, isLoading: false, isAuthenticated: false });
            }
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const { token, user } = await authAPI.login({ email, password });
            await setAuthToken(token);
            await cacheUser(user);

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

    const register = async (email: string, password: string, name: string, gymCode: string, avatarUrl?: string | null) => {
        try {
            const { token, user } = await authAPI.register({
                email,
                password,
                name,
                gym_code: gymCode,
            });
            await setAuthToken(token);

            const registeredUser = {
                ...user,
                onboarding_completed: user.onboarding_completed ?? false,
            };
            await cacheUser(registeredUser);

            // Initialize offline store
            useOfflineStore.getState().setOnline(true);

            setState({
                user: registeredUser,
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
        await cacheUser(null);
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
            await cacheUser(user);

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

    const resetPassword = async (email: string, code: string, password: string) => {
        return authAPI.resetPassword(email, code, password);
    };

    const refreshUser = async () => {
        try {
            const { user } = await authAPI.getMe();
            await cacheUser(user);
            setState((prev) => ({ ...prev, user }));
        } catch (error: any) {
            // Only a real 401 should end the session. This used to log out on any
            // failure, so a momentary signal drop mid-session bounced the user to
            // the login screen.
            if (isAuthFailure(error)) {
                await logout();
            }
            // Otherwise keep the current profile; the next refresh will catch up.
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
                resetPassword,
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
