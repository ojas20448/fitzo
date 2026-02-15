/**
 * Offline Data Store
 * 
 * Caches API responses for offline access using zustand with AsyncStorage persistence.
 * Key data like home, lessons, and exercises are cached for offline use.
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
            isOnline: true, // Default to true

            // Set online status
            setOnline: (status) => set({ isOnline: status }),

            // Cache home screen data
            cacheHomeData: (data) => set({
                homeData: {
                    ...data,
                    timestamp: Date.now(),
                },
                lastHomeUpdate: Date.now(),
            }),

            // Cache a single lesson
            cacheLesson: (lesson) => set((state) => ({
                lessons: {
                    ...state.lessons,
                    [lesson.id]: lesson,
                },
            })),

            // Cache units list
            cacheUnits: (units) => set({
                units,
                lastLessonsUpdate: Date.now(),
            }),

            // Cache exercises list
            cacheExercises: (exercises) => set({
                exercises,
                lastExercisesUpdate: Date.now(),
            }),

            // Cache recipes list
            cacheRecipes: (recipes) => set({
                recipes,
                lastRecipesUpdate: Date.now(),
            }),

            // Get cached home data
            getHomeData: () => get().homeData,

            // Get cached lesson by ID
            getLesson: (id) => get().lessons[id],

            // Get cached units
            getUnits: () => get().units,

            // Get cached exercises
            getExercises: () => get().exercises,

            // Get cached recipes
            getRecipes: () => get().recipes,

            // Check if home data is stale (older than 1 hour)
            isHomeStale: () => {
                const lastUpdate = get().lastHomeUpdate;
                return Date.now() - lastUpdate > ONE_HOUR;
            },

            // Check if lessons data is stale
            isLessonsStale: () => {
                const lastUpdate = get().lastLessonsUpdate;
                return Date.now() - lastUpdate > ONE_HOUR;
            },

            // Check if exercises data is stale
            isExercisesStale: () => {
                const lastUpdate = get().lastExercisesUpdate;
                return Date.now() - lastUpdate > ONE_HOUR * 24; // Keep exercises for 24 hours
            },

            // Check if recipes data is stale
            isRecipesStale: () => {
                const lastUpdate = get().lastRecipesUpdate;
                return Date.now() - lastUpdate > ONE_HOUR * 24; // Keep recipes for 24 hours
            },

            // Clear all cached data
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
            // Only persist essential data, not getters/checkers
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
            }),
        }
    )
);

export default useOfflineStore;
