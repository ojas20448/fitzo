import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nutritionAPI, workoutsAPI } from '../services/api';
import { useAuth } from './AuthContext';

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface MacroTargets {
    protein: number;
    carbs: number;
    fat: number;
}

interface NutritionContextType {
    todayMacros: Macros;
    calorieGoal: number | null;
    macroTargets: MacroTargets | null;
    weeklyWorkoutGoal: number;
    updateWeeklyGoal: (days: number) => Promise<void>;
    lastUpdatedAt: number;
    isLoading: boolean;
    refreshToday: () => Promise<void>;
    logFoodOptimistic: (food: { calories: number; protein: number; carbs: number; fat: number; serving_size: string; food_name: string; cooking_medium?: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; visibility?: string }) => Promise<{ isGoalHit: boolean }>;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

const AccountNutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id;
    const [todayMacros, setTodayMacros] = useState<Macros>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
    const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
    const [isLoading, setIsLoading] = useState(false);
    const requestVersion = useRef(0);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const refreshToday = useCallback(async () => {
        if (!userId) return;
        const version = ++requestVersion.current;
        setIsLoading(true);

        try {
            const data = await nutritionAPI.getToday();
            if (!mounted.current || version !== requestVersion.current) return;
            if (data?.logged) {
                setTodayMacros({
                    calories: data.logged.calories || 0,
                    protein: data.logged.protein || 0,
                    carbs: data.logged.carbs || 0,
                    fat: data.logged.fat || 0,
                });
                setLastUpdatedAt(Date.now());
            }

            setCalorieGoal(data.targets?.calories ?? null);
            setMacroTargets(data.targets ? { protein: data.targets.protein, carbs: data.targets.carbs, fat: data.targets.fat } : null);
        } catch {
            // Silently fail - non-critical
        } finally { if (mounted.current && version === requestVersion.current) setIsLoading(false); }
    }, [userId]);

    const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState<number>(4);

    /**
     * Resolve the weekly workout goal.
     *
     * Precedence: an explicit goal the user set in Fitness Profile, then the
     * days-per-week of their active training split, then 4.
     *
     * The split step is the point of this. Previously the goal was a hardcoded
     * 4 that only ever changed if the user went and set it by hand, so someone
     * who picked the PPL 6-day split saw "0 / 4 workouts" on the home screen
     * and hit "Weekly goal crushed!" two sessions before finishing their week.
     * Picking a split is already a statement of how often you intend to train;
     * the goal should follow it without being asked twice.
     */
    const weeklyGoalVersion = useRef(0);
    const loadWeeklyGoal = useCallback(async () => {
        if (!userId) return;
        const version = ++weeklyGoalVersion.current;
        try {
            const stored = await AsyncStorage.getItem(`weekly_goal_${userId}`);
            if (stored) {
                const n = Number(stored);
                // Guard the parse: a corrupt key used to yield NaN, and
                // `workouts >= NaN` is false forever, so the goal could never
                // be met.
                if (Number.isInteger(n) && n >= 1 && n <= 7 && mounted.current && version === weeklyGoalVersion.current) {
                    setWeeklyWorkoutGoal(n);
                    return;
                }
            }

            const res = await workoutsAPI.getMySplits();
            const days = res?.splits?.find((split: any) => split.is_active)?.days_per_week;
            if (Number.isInteger(days) && days >= 1 && days <= 7 && mounted.current && version === weeklyGoalVersion.current) {
                setWeeklyWorkoutGoal(days);
            }
        } catch {
            // Non-critical: the useState default of 4 stands.
        }
    }, [userId]);
    useEffect(() => { if (userId) { void refreshToday(); void loadWeeklyGoal(); } }, [userId, refreshToday, loadWeeklyGoal]);

    const updateWeeklyGoal = async (days: number) => {
        if (!Number.isInteger(days) || days < 1 || days > 7) throw new Error('Choose between 1 and 7 workouts per week.');
        weeklyGoalVersion.current++;
        setWeeklyWorkoutGoal(days);
        try {
            if (userId) {
                await AsyncStorage.setItem(`weekly_goal_${userId}`, String(days));
            }
        } catch {
        }
    };



    const logFoodOptimistic = async (food: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        serving_size: string;
        food_name: string;
        cooking_medium?: string;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        visibility?: string;
    }) => {
        const previousMacros = { ...todayMacros };
        const previousUpdate = lastUpdatedAt;
        requestVersion.current++;
        setIsLoading(false);

        const newMacros = {
            calories: previousMacros.calories + (food.calories || 0),
            protein: previousMacros.protein + (food.protein || 0),
            carbs: previousMacros.carbs + (food.carbs || 0),
            fat: previousMacros.fat + (food.fat || 0),
        };

        setTodayMacros(newMacros);
        setLastUpdatedAt(Date.now());

        const threshold = (calorieGoal ?? 0) * 0.9;
        const isGoalHit = calorieGoal !== null && previousMacros.calories < threshold && newMacros.calories >= threshold;

        try {
            await nutritionAPI.logFood(food);
            refreshToday();
            return { isGoalHit };
        } catch (error) {
            setTodayMacros(previousMacros);
            setLastUpdatedAt(previousUpdate);
            throw error;
        }
    };

    return (
        <NutritionContext.Provider value={{
            todayMacros,
            calorieGoal,
            macroTargets,
            weeklyWorkoutGoal,
            updateWeeklyGoal,
            lastUpdatedAt,
            isLoading,
            refreshToday,
            logFoodOptimistic
        }}>
            {children}
        </NutritionContext.Provider>
    );
};

export const useNutrition = () => {
    const context = useContext(NutritionContext);
    if (context === undefined) {
        throw new Error('useNutrition must be used within a NutritionProvider');
    }
    return context;
};

// Remount all account-specific state on an identity change. Late promises from
// the previous provider cannot update the new account's totals or goals.
export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    return <AccountNutritionProvider key={user?.id ?? 'signed-out'}>{children}</AccountNutritionProvider>;
};
