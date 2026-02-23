/**
 * Offline Data Store
 *
 * Caches API responses for offline access using zustand with AsyncStorage persistence.
 * Key data like home, lessons, and exercises are cached for offline use.
 *
 * WRITE QUEUE: Queues workout logs, calorie logs, and other writes when offline.
 * Automatically syncs when connectivity is restored.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedHomeData {
    user: any;
    streak: { current: number; history: string[] };
    intent: any;
    crowd: { level: string; count: number };
    gym: any;
    todaysLog: any;
    timestamp: number;
}

interface CachedLesson {
    id: string;
    title: string;
    content: string;
    questions: any[];
    xp_reward: number;
}

// ===========================================
// OFFLINE WRITE QUEUE TYPES
// ===========================================
type PendingActionType = 'LOG_WORKOUT' | 'LOG_CALORIES' | 'SET_INTENT' | 'CREATE_POST' | 'ADD_COMMENT';

interface PendingAction {
    id: string;
    type: PendingActionType;
    payload: any;
    createdAt: number;
    retryCount: number;
    lastError?: string;
}

interface OfflineStore {
    // Cached data
    homeData: CachedHomeData | null;
    lessons: Record<string, CachedLesson>;
    units: any[];
    exercises: any[];
    recipes: any[];

    // Cache timestamps (for staleness checks)
    lastHomeUpdate: number;
    lastLessonsUpdate: number;
    lastExercisesUpdate: number;
    lastRecipesUpdate: number;

    // Connectivity state
    isOnline: boolean;
    setOnline: (status: boolean) => void;

    // ===== WRITE QUEUE =====
    pendingActions: PendingAction[];
    isSyncing: boolean;
    lastSyncAt: number;

    // Queue a new action for offline sync
    queueAction: (type: PendingActionType, payload: any) => string;
    // Remove a successfully synced action
    dequeueAction: (id: string) => void;
    // Mark an action as failed (increment retry, store error)
    markActionFailed: (id: string, error: string) => void;
    // Get all pending actions
    getPendingActions: () => PendingAction[];
    // Get count of pending actions
    getPendingCount: () => number;
    // Set syncing state
    setSyncing: (syncing: boolean) => void;
    // Clear all failed actions (after max retries)
    clearFailedActions: () => void;

    // Actions
    cacheHomeData: (data: any) => void;
    cacheLesson: (lesson: CachedLesson) => void;
    cacheUnits: (units: any[]) => void;
    cacheExercises: (exercises: any[]) => void;
    cacheRecipes: (recipes: any[]) => void;

    // Getters
    getHomeData: () => CachedHomeData | null;
    getLesson: (id: string) => CachedLesson | undefined;
    getUnits: () => any[];
    getExercises: () => any[];
    getRecipes: () => any[];

    // Staleness check (data older than 1 hour is stale)
    isHomeStale: () => boolean;
    isLessonsStale: () => boolean;
    isExercisesStale: () => boolean;
    isRecipesStale: () => boolean;

    // Clear cache
    clearCache: () => void;
}

const ONE_HOUR = 60 * 60 * 1000;
const MAX_RETRIES = 5;

// Simple unique ID generator (no external dependency)
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set, get) => ({
            // Initial state
            homeData: null,
            lessons: {},
            units: [],
            exercises: [],
            recipes: [],
            lastHomeUpdate: 0,
            lastLessonsUpdate: 0,
            lastExercisesUpdate: 0,
            lastRecipesUpdate: 0,
            isOnline: true,

            // Write queue state
            pendingActions: [],
            isSyncing: false,
            lastSyncAt: 0,

            // Set online status
            setOnline: (status) => set({ isOnline: status }),

            // ===== WRITE QUEUE ACTIONS =====

            queueAction: (type, payload) => {
                const id = generateId();
                const action: PendingAction = {
                    id,
                    type,
                    payload,
                    createdAt: Date.now(),
                    retryCount: 0,
                };
                set((state) => ({
                    pendingActions: [...state.pendingActions, action],
                }));
                return id;
            },

            dequeueAction: (id) => {
                set((state) => ({
                    pendingActions: state.pendingActions.filter((a) => a.id !== id),
                    lastSyncAt: Date.now(),
                }));
            },

            markActionFailed: (id, error) => {
                set((state) => ({
                    pendingActions: state.pendingActions.map((a) =>
                        a.id === id
                            ? { ...a, retryCount: a.retryCount + 1, lastError: error }
                            : a
                    ),
                }));
            },

            getPendingActions: () => get().pendingActions,

            getPendingCount: () => get().pendingActions.length,

            setSyncing: (syncing) => set({ isSyncing: syncing }),

            clearFailedActions: () => {
                set((state) => ({
                    pendingActions: state.pendingActions.filter(
                        (a) => a.retryCount < MAX_RETRIES
                    ),
                }));
            },

            // ===== READ CACHE ACTIONS =====

            cacheHomeData: (data) => set({
                homeData: {
                    ...data,
                    timestamp: Date.now(),
                },
                lastHomeUpdate: Date.now(),
            }),

            cacheLesson: (lesson) => set((state) => ({
                lessons: {
                    ...state.lessons,
                    [lesson.id]: lesson,
                },
            })),

            cacheUnits: (units) => set({
                units,
                lastLessonsUpdate: Date.now(),
            }),

            cacheExercises: (exercises) => set({
                exercises,
                lastExercisesUpdate: Date.now(),
            }),

            cacheRecipes: (recipes) => set({
                recipes,
                lastRecipesUpdate: Date.now(),
            }),

            // Getters
            getHomeData: () => get().homeData,
            getLesson: (id) => get().lessons[id],
            getUnits: () => get().units,
            getExercises: () => get().exercises,
            getRecipes: () => get().recipes,

            // Staleness checks
            isHomeStale: () => {
                const lastUpdate = get().lastHomeUpdate;
                return Date.now() - lastUpdate > ONE_HOUR;
            },

            isLessonsStale: () => {
                const lastUpdate = get().lastLessonsUpdate;
                return Date.now() - lastUpdate > ONE_HOUR;
            },

            isExercisesStale: () => {
                const lastUpdate = get().lastExercisesUpdate;
                return Date.now() - lastUpdate > ONE_HOUR * 24;
            },

            isRecipesStale: () => {
                const lastUpdate = get().lastRecipesUpdate;
                return Date.now() - lastUpdate > ONE_HOUR * 24;
            },

            // Clear all cached data (preserves pending actions)
            clearCache: () => set({
                homeData: null,
                lessons: {},
                units: [],
                exercises: [],
                recipes: [],
                lastHomeUpdate: 0,
                lastLessonsUpdate: 0,
                lastExercisesUpdate: 0,
                lastRecipesUpdate: 0,
            }),
        }),
        {
            name: 'fitzo-offline-cache',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                homeData: state.homeData,
                lessons: state.lessons,
                units: state.units,
                exercises: state.exercises,
                recipes: state.recipes,
                lastHomeUpdate: state.lastHomeUpdate,
                lastLessonsUpdate: state.lastLessonsUpdate,
                lastExercisesUpdate: state.lastExercisesUpdate,
                lastRecipesUpdate: state.lastRecipesUpdate,
                // Persist the write queue — critical for offline reliability
                pendingActions: state.pendingActions,
                lastSyncAt: state.lastSyncAt,
            }),
        }
    )
);

export default useOfflineStore;
