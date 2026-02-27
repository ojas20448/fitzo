import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authEvents } from './authEvents';
import { useOfflineStore } from '../stores/offlineStore';

// API base URL - EAS Build injects EXPO_PUBLIC_API_URL at build time from eas.json.
// Falls back to production server when not set.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://fitzo.onrender.com/api';


// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Token management - platform aware (web uses localStorage, native uses SecureStore)
const TOKEN_KEY = 'fitzo_auth_token';

export const setAuthToken = async (token: string): Promise<void> => {
    if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
};

export const getAuthToken = async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const removeAuthToken = async (): Promise<void> => {
    if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
    } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
};

// Request interceptor - add auth token (except for auth endpoints)
api.interceptors.request.use(
    async (config) => {
        // Don't add auth token to login/register/google endpoints
        const isAuthEndpoint = config.url?.includes('/auth/login') ||
            config.url?.includes('/auth/register') ||
            config.url?.includes('/auth/google');

        if (!isAuthEndpoint) {
            const token = await getAuthToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);



// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle token expiry - but NOT on auth endpoints (login/register)
        const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
            originalRequest?.url?.includes('/auth/register') ||
            originalRequest?.url?.includes('/auth/google');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            // Token expired or invalid - clear it
            await removeAuthToken();
            authEvents.emitLogout();
        }

        // Transform error to user-friendly message
        const message = error.response?.data?.message ||
            error.response?.data?.error ||
            (error.code === 'ERR_NETWORK' ? 'Cannot connect to server. Please check your internet connection.' : 'Something went wrong. Please try again.');

        return Promise.reject({
            message,
            code: error.response?.data?.code || (error.code === 'ERR_NETWORK' ? 'NETWORK_ERROR' : 'UNKNOWN'),
            status: error.response?.status || 0,
        });
    }
);

// ===========================================
// AUTH ENDPOINTS
// ===========================================

export const authAPI = {
    register: async (data: { email: string; password: string; name: string; gym_code: string }) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    login: async (data: { email: string; password: string }) => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },

    devLogin: async () => {
        const response = await api.post('/auth/dev-login', {});
        return response.data;
    },

    googleLogin: async (token: string) => {
        const response = await api.post('/auth/google', { token });
        return response.data;
    },

    forgotPassword: async (email: string) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (email: string, code: string, password: string) => {
        const response = await api.post('/auth/reset-password', { email, code, password });
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },
};

// ===========================================
// MEMBER ENDPOINTS
// ===========================================

export const memberAPI = {
    getHome: async () => {
        try {
            const response = await api.get('/member/home');
            // Cache for offline use
            useOfflineStore.getState().cacheHomeData(response.data);
            return response.data;
        } catch (error: any) {
            // On network error, return cached data if available
            if (error.code === 'NETWORK_ERROR') {
                const cached = useOfflineStore.getState().getHomeData();
                if (cached) return cached;
            }
            throw error;
        }
    },

    updateProfile: async (data: { name?: string; avatar_url?: string }) => {
        const response = await api.put('/member/profile', data);
        return response.data;
    },
};

// ===========================================
// CHECK-IN ENDPOINTS
// ===========================================

export const checkinAPI = {
    checkin: async (gymId: string) => {
        const response = await api.post('/checkin', { gym_id: gymId });
        return response.data;
    },

    getStatus: async () => {
        const response = await api.get('/checkin/status');
        return response.data;
    },

    getHistory: async (days = 30) => {
        const response = await api.get(`/checkin/history?days=${days}`);
        return response.data;
    },
};

// ===========================================
// INTENT ENDPOINTS
// ===========================================

export const intentAPI = {
    setIntent: async (data: {
        training_pattern?: string | null;
        emphasis: string[];
        session_label?: string | null;
        visibility?: string;
        note?: string;
    }) => {
        const response = await api.post('/intent', data);
        return response.data;
    },

    getIntent: async () => {
        const response = await api.get('/intent');
        return response.data;
    },

    getFeed: async () => {
        const response = await api.get('/intent/feed');
        return response.data;
    },

    getSessions: async (splitType: string) => {
        const response = await api.get(`/intent/sessions/${splitType}`);
        return response.data;
    },

    clearIntent: async () => {
        const response = await api.delete('/intent');
        return response.data;
    },
};

// ===========================================
// FRIENDS ENDPOINTS
// ===========================================

export const friendsAPI = {
    getFriends: async () => {
        const response = await api.get('/friends');
        return response.data;
    },

    sendRequest: async (friendId: string) => {
        const response = await api.post('/friends/request', { friend_id: friendId });
        return response.data;
    },

    acceptRequest: async (friendId: string) => {
        const response = await api.post('/friends/accept', { friend_id: friendId });
        return response.data;
    },

    rejectRequest: async (friendId: string) => {
        const response = await api.post('/friends/reject', { friend_id: friendId });
        return response.data;
    },

    removeFriend: async (friendId: string) => {
        const response = await api.delete(`/friends/${friendId}`);
        return response.data;
    },

    search: async (query: string) => {
        const response = await api.get(`/friends/search?q=${encodeURIComponent(query)}`);
        return response.data;
    },

    getSuggested: async (limit = 5) => {
        const response = await api.get(`/friends/suggested?limit=${limit}`);
        return response.data;
    },

    blockUser: async (userId: string) => {
        const response = await api.post(`/friends/${userId}/block`);
        return response.data;
    },

    getFriendshipStatus: async (userId: string) => {
        const response = await api.get(`/friends/${userId}/status`);
        return response.data;
    },
};

// ===========================================
// BUDDY ACTIVITY ENDPOINTS
// ===========================================

export const buddyActivityAPI = {
    getActivity: async (userId: string) => {
        const response = await api.get(`/buddy-activity/${userId}`);
        return response.data;
    },
};

// ===========================================
// SETTINGS ENDPOINTS
// ===========================================
export const settingsAPI = {
    getSharingPreference: async () => {
        const response = await api.get('/settings/sharing');
        return response.data;
    },
    updateSharingPreference: async (shareLogsDefault: boolean) => {
        const response = await api.patch('/settings/sharing', { share_logs_default: shareLogsDefault });
        return response.data;
    },
};

// ===========================================
// LEARN ENDPOINTS
// ===========================================

export const learnAPI = {
    getLessons: async () => {
        try {
            const response = await api.get('/learn/lessons');
            // Cache units for offline use
            if (response.data?.units) {
                useOfflineStore.getState().cacheUnits(response.data.units);
            }
            return response.data;
        } catch (error: any) {
            if (error.code === 'NETWORK_ERROR') {
                const units = useOfflineStore.getState().getUnits();
                if (units.length > 0) return { units, progress: {} };
            }
            throw error;
        }
    },

    getLesson: async (lessonId: string) => {
        try {
            const response = await api.get(`/learn/lessons/${lessonId}`);
            // Cache lesson for offline use
            if (response.data?.lesson) {
                useOfflineStore.getState().cacheLesson(response.data.lesson);
            }
            return response.data;
        } catch (error: any) {
            if (error.code === 'NETWORK_ERROR') {
                const cached = useOfflineStore.getState().getLesson(lessonId);
                if (cached) return { lesson: cached };
            }
            throw error;
        }
    },

    submitAttempt: async (lessonId: string, answers: number[]) => {
        const response = await api.post('/learn/attempt', { lesson_id: lessonId, answers });
        return response.data;
    },

    getProgress: async () => {
        const response = await api.get('/learn/progress');
        return response.data;
    },
};

// ===========================================
// CLASSES ENDPOINTS
// ===========================================

export const classesAPI = {
    getClasses: async (date?: string) => {
        const url = date ? `/classes?date=${date}` : '/classes';
        const response = await api.get(url);
        return response.data;
    },

    bookClass: async (sessionId: string) => {
        const response = await api.post(`/classes/${sessionId}/book`);
        return response.data;
    },

    cancelBooking: async (sessionId: string) => {
        const response = await api.delete(`/classes/${sessionId}/book`);
        return response.data;
    },

    getMyBookings: async () => {
        const response = await api.get('/classes/my-bookings');
        return response.data;
    },
};

// ===========================================
// TRAINER ENDPOINTS
// ===========================================

export const trainerAPI = {
    getMembers: async () => {
        const response = await api.get('/trainer/members');
        return response.data;
    },

    getMemberDetail: async (memberId: string) => {
        const response = await api.get(`/trainer/members/${memberId}`);
        return response.data;
    },

    getSchedule: async () => {
        const response = await api.get('/trainer/schedule');
        return response.data;
    },

    getMemberNutritionHistory: async (memberId: string) => {
        const response = await api.get(`/trainer/members/${memberId}/nutrition`);
        return response.data;
    },

    sendNudge: async (memberId: string, type: string, message: string) => {
        const response = await api.post(`/trainer/members/${memberId}/nudge`, { type, message });
        return response.data;
    },
};

// ===========================================
// MANAGER ENDPOINTS
// ===========================================

export const managerAPI = {
    getDashboard: async () => {
        const response = await api.get('/manager/dashboard');
        return response.data;
    },

    addUser: async (data: { email: string; name: string; role: 'member' | 'trainer'; trainer_id?: string }) => {
        const response = await api.post('/manager/users', data);
        return response.data;
    },

    getMembers: async () => {
        const response = await api.get('/manager/members');
        return response.data;
    },

    getTrainers: async () => {
        const response = await api.get('/manager/trainers');
        return response.data;
    },
};

// ===========================================
// WORKOUTS ENDPOINTS
// ===========================================

export const workoutsAPI = {
    log: async (data: { workout_type: string; exercises?: string; notes?: string; visibility?: string }) => {
        const response = await api.post('/workouts', data);
        return response.data;
    },

    startSession: async (data: { split_id: string | null; day_name: string; visibility: string }) => {
        const response = await api.post('/workouts/sessions', data);
        return response.data;
    },

    getSession: async (sessionId: string) => {
        const response = await api.get(`/workouts/sessions/${sessionId}`);
        return response.data;
    },

    completeSession: async (sessionId: string, data: { notes?: string }) => {
        const response = await api.put(`/workouts/sessions/${sessionId}/complete`, data);
        return response.data;
    },

    getToday: async () => {
        const response = await api.get('/workouts/today');
        return response.data;
    },

    getLatest: async (type: string) => {
        const response = await api.get(`/workouts/latest?type=${encodeURIComponent(type)}`);
        return response.data;
    },

    getHistory: async (limit = 30) => {
        const response = await api.get(`/workouts/history?limit=${limit}`);
        return response.data;
    },

    getFeed: async () => {
        const response = await api.get('/workouts/feed');
        return response.data;
    },

    delete: async (workoutId: string) => {
        const response = await api.delete(`/workouts/${workoutId}`);
        return response.data;
    },

    getMySplits: async () => {
        const response = await api.get('/workouts/splits');
        return response.data;
    },

    saveSplit: async (data: any) => {
        const response = await api.post('/workouts/splits', data);
        return response.data;
    },

    getPublishedSplits: async (filters?: { days?: number; difficulty?: string; official?: boolean }) => {
        const response = await api.get('/workouts/published', { params: filters });
        return response.data;
    },

    adoptSplit: async (splitId: string) => {
        const response = await api.post(`/workouts/published/${splitId}/adopt`);
        return response.data;
    },

    searchExercises: async (queryStr: string = '') => {
        const response = await api.get(`/workouts/exercises?search=${encodeURIComponent(queryStr)}`);
        return response.data;
    },

    addExerciseToSession: async (sessionId: string, exerciseId: string) => {
        const response = await api.post(`/workouts/sessions/${sessionId}/exercises`, { exercise_id: exerciseId });
        return response.data;
    },

    addSet: async (exerciseLogId: string, data: { reps: number; weight_kg: number; rpe?: number }) => {
        const response = await api.post(`/workouts/exercises/${exerciseLogId}/sets`, data);
        return response.data;
    },

    updateSet: async (setId: string, data: { reps?: number; weight_kg?: number; is_failure?: boolean; rpe?: number }) => {
        const response = await api.put(`/workouts/sets/${setId}`, data);
        return response.data;
    },

    publishSplit: async (data: {
        name: string;
        description: string;
        days_per_week: number;
        difficulty_level: string;
        program_structure: Record<string, string>;
        tags: string[];
    }) => {
        const response = await api.post('/workouts/published', data);
        return response.data;
    },

    like: async (workoutId: string) => {
        const response = await api.post(`/workouts/${workoutId}/like`);
        return response.data;
    },

    unlike: async (workoutId: string) => {
        const response = await api.delete(`/workouts/${workoutId}/like`);
        return response.data;
    },
};

// ===========================================
// CALORIES ENDPOINTS
// ===========================================

export const caloriesAPI = {
    log: async (data: { calories: number; protein?: number; carbs?: number; fat?: number; meal_name?: string; visibility?: string }) => {
        const response = await api.post('/calories', data);
        return response.data;
    },

    getToday: async () => {
        const response = await api.get('/calories/today');
        return response.data;
    },

    getHistory: async (limit = 30) => {
        const response = await api.get(`/calories/history?limit=${limit}`);
        return response.data;
    },

    getFeed: async () => {
        const response = await api.get('/calories/feed');
        return response.data;
    },

    delete: async (entryId: string) => {
        const response = await api.delete(`/calories/${entryId}`);
        return response.data;
    },

    getFrequentFoods: async (limit = 10) => {
        const response = await api.get(`/calories/frequent?limit=${limit}`);
        return response.data;
    },
};

// ===========================================
// FOOD ENDPOINTS (FatSecret)
// ===========================================

export const foodAPI = {
    search: async (query: string, page = 0, limit = 20) => {
        const response = await api.get(`/food/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
        return response.data;
    },

    getDetails: async (foodId: string, source = 'indian') => {
        const response = await api.get(`/food/${foodId}?source=${source}`);
        return response.data;
    },

    getCategories: async () => {
        const response = await api.get('/food/categories/indian');
        return response.data;
    },

    getGymFoods: async () => {
        const response = await api.get('/food/gym-foods');
        return response.data;
    },

    analyzeText: async (text: string) => {
        const response = await api.post('/food/analyze-text', { text }, { timeout: 60000 });
        return response.data;
    },
};

// ===========================================
// NUTRITION PROFILE ENDPOINTS
// ===========================================

export const nutritionAPI = {
    getProfile: async () => {
        const response = await api.get('/nutrition/profile');
        return response.data;
    },

    updateProfile: async (data: {
        weight_kg: number;
        height_cm: number;
        age: number;
        gender: 'male' | 'female';
        activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
        goal_type?: 'fat_loss' | 'maintenance' | 'muscle_gain';
        target_weight_kg?: number;
        is_vegetarian?: boolean;
    }) => {
        const response = await api.post('/nutrition/profile', data);
        return response.data;
    },

    getToday: async () => {
        const response = await api.get('/nutrition/today');
        return response.data;
    },

    logFood: async (data: {
        food_name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        serving_size: string;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    }) => {
        const response = await api.post('/nutrition/log', data);
        return response.data;
    },
};

// ===========================================
// RECIPE ENDPOINTS
// ===========================================

export const recipesAPI = {
    getAll: async () => {
        const response = await api.get('/recipes');
        return response.data;
    },

    getOne: async (id: string) => {
        const response = await api.get(`/recipes/${id}`);
        return response.data;
    },

    create: async (data: {
        name: string;
        description?: string;
        instructions?: string;
        ingredients: any[];
        total_calories: number;
        total_protein: number;
        total_carbs: number;
        total_fat: number;
    }) => {
        const response = await api.post('/recipes', data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/recipes/${id}`);
        return response.data;
    },
};

// ===========================================
// AI COACH ENDPOINTS
// ===========================================

export const aiAPI = {
    generateWorkoutPlan: async (profile: any) => {
        const response = await api.post('/ai/workout-plan', profile, { timeout: 60000 });
        return response.data;
    },

    getNutritionAdvice: async (profile: any) => {
        const response = await api.post('/ai/nutrition-advice', profile, { timeout: 60000 });
        return response.data;
    },

    chat: async (question: string, context?: any) => {
        const response = await api.post('/ai/chat', { question, context }, { timeout: 60000 });
        return response.data;
    },

    analyzeForm: async (exerciseName: string, description: string) => {
        const response = await api.post('/ai/analyze-form', { exerciseName, description }, { timeout: 60000 });
        return response.data;
    },
};

// ===========================================
// EXERCISE LIBRARY ENDPOINTS
// ===========================================

export const exerciseAPI = {
    getAll: async (limit = 20, offset = 0) => {
        const response = await api.get(`/exercises?limit=${limit}&offset=${offset}`);
        return response.data;
    },

    search: async (query: string) => {
        const response = await api.get(`/exercises/search/${query}`);
        return response.data;
    },

    getByBodyPart: async (bodyPart: string) => {
        const response = await api.get(`/exercises/bodypart/${bodyPart}`);
        return response.data;
    },

    getByTarget: async (target: string) => {
        const response = await api.get(`/exercises/target/${target}`);
        return response.data;
    },

    getByEquipment: async (equipment: string) => {
        const response = await api.get(`/exercises/equipment/${equipment}`);
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/exercises/${id}`);
        return response.data;
    },

    getBodyParts: async () => {
        const response = await api.get('/exercises/lists/bodyparts');
        return response.data;
    },

    getTargets: async () => {
        const response = await api.get('/exercises/lists/targets');
        return response.data;
    },
};

// ===========================================
// FOOD PHOTO ANALYSIS ENDPOINTS
// ===========================================

export const foodPhotoAPI = {
    analyzeText: async (text: string) => {
        const response = await api.post('/food/analyze-text', { text }, { timeout: 60000 });
        return response.data;
    },

    /**
     * Analyze food from photo using Gemini Vision (FREE)
     * @param base64Image - Base64-encoded image data
     * @param mimeType - Image MIME type (default: image/jpeg)
     */
    analyzePhoto: async (base64Image: string, mimeType: string = 'image/jpeg') => {
        const response = await api.post('/food/analyze-photo', {
            image: base64Image,
            mimeType,
        }, { timeout: 60000 });
        return response.data;
    },

    lookupBarcode: async (barcode: string) => {
        const response = await api.post('/food/barcode', { barcode });
        return response.data;
    },
};

// ===========================================
// VIDEO ENDPOINTS
// ===========================================

export const videoAPI = {
    search: async (query: string, limit = 10) => {
        const response = await api.get(`/videos/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        return response.data;
    },

    getTrending: async (limit = 20) => {
        const response = await api.get(`/videos/trending?limit=${limit}`);
        return response.data;
    },

    getDetails: async (videoId: string) => {
        const response = await api.get(`/videos/${videoId}`);
        return response.data;
    },
};

// ===========================================
// CALORIES BURNED ENDPOINTS
// ===========================================

export const caloriesBurnedAPI = {
    calculate: async (activity: string, duration: number, weight?: number) => {
        const response = await api.post('/workouts/calculate-calories', {
            activity,
            duration,
            weight
        });
        return response.data;
    },
};

// ===========================================
// MEASUREMENTS ENDPOINTS
// ===========================================

export const measurementsAPI = {
    getLatest: async () => {
        const response = await api.get('/measurements/latest');
        return response.data;
    },

    log: async (data: any) => {
        const response = await api.post('/measurements', data);
        return response.data;
    },

    getHistory: async () => {
        const response = await api.get('/measurements/history');
        return response.data;
    },
};

// ===========================================
// POSTS ENDPOINTS
// ===========================================

export const postsAPI = {
    create: async (data: { content: string; visibility: 'public' | 'friends' }) => {
        const response = await api.post('/posts', data);
        return response.data;
    },

    getFeed: async (limit = 20, offset = 0) => {
        const response = await api.get(`/posts/feed?limit=${limit}&offset=${offset}`);
        return response.data;
    },

    getPost: async (id: string) => {
        const response = await api.get(`/posts/${id}`);
        return response.data;
    },

    like: async (id: string) => {
        const response = await api.post(`/posts/${id}/like`);
        return response.data;
    },

    unlike: async (id: string) => {
        const response = await api.delete(`/posts/${id}/like`);
        return response.data;
    },

    getComments: async (id: string) => {
        const response = await api.get(`/posts/${id}/comments`);
        return response.data;
    },

    addComment: async (id: string, comment: string) => {
        const response = await api.post(`/posts/${id}/comments`, { comment });
        return response.data;
    },

    deletePost: async (id: string) => {
        const response = await api.delete(`/posts/${id}`);
        return response.data;
    },

    updatePost: async (id: string, data: { content: string; visibility?: 'public' | 'friends' }) => {
        const response = await api.put(`/posts/${id}`, data);
        return response.data;
    },
};

// ===========================================
// PROGRESS & PR TRACKING ENDPOINTS
// ===========================================

export const progressAPI = {
    /** Get all-time PRs for every exercise */
    getPRs: async () => {
        const response = await api.get('/progress/prs');
        return response.data;
    },

    /** Get PR history for a specific exercise */
    getExercisePRHistory: async (exerciseId: string) => {
        const response = await api.get(`/progress/prs/${exerciseId}`);
        return response.data;
    },

    /** Get weekly volume trends */
    getVolumeTrends: async (weeks: number = 8, muscleGroup?: string) => {
        const params = new URLSearchParams({ weeks: weeks.toString() });
        if (muscleGroup) params.set('muscle_group', muscleGroup);
        const response = await api.get(`/progress/volume?${params.toString()}`);
        return response.data;
    },

    /** Get estimated 1RM strength curve for an exercise */
    getStrengthCurve: async (exerciseId: string) => {
        const response = await api.get(`/progress/strength/${exerciseId}`);
        return response.data;
    },
};

// ===========================================
// HEALTH / WEARABLE ENDPOINTS
// ===========================================

export const healthAPI = {
    /** Sync health data from wearable */
    sync: async (data: {
        steps: number;
        active_calories: number;
        resting_heart_rate?: number | null;
        sleep_hours?: number | null;
        date?: string;
    }) => {
        const response = await api.post('/health/sync', data);
        return response.data;
    },

    /** Get today's health summary */
    getToday: async () => {
        const response = await api.get('/health/today');
        return response.data;
    },

    /** Get health data history */
    getHistory: async (days: number = 30) => {
        const response = await api.get(`/health/history?days=${days}`);
        return response.data;
    },
};

// ===========================================
// NOTIFICATIONS ENDPOINTS
// ===========================================

export const notificationsAPI = {
    registerPushToken: async (token: string, platform: string) => {
        const response = await api.post('/notifications/register', { token, platform });
        return response.data;
    },

    unregisterPushToken: async () => {
        const response = await api.delete('/notifications/unregister');
        return response.data;
    },

    getStatus: async () => {
        const response = await api.get('/notifications/status');
        return response.data;
    },

    getPreferences: async () => {
        const response = await api.get('/notifications/preferences');
        return response.data;
    },

    updatePreferences: async (preferences: Record<string, boolean>) => {
        const response = await api.put('/notifications/preferences', preferences);
        return response.data;
    },

    sendTestNotification: async () => {
        const response = await api.post('/notifications/test');
        return response.data;
    },
};

export default api;

