import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    calorieGoal: number;
    macroTargets: MacroTargets;
    weeklyWorkoutGoal: number;
    updateWeeklyGoal: (days: number) => Promise<void>;
    lastUpdatedAt: number;
    isLoading: boolean;
    refreshToday: () => Promise<void>;
    logFoodOptimistic: (food: { calories: number; protein: number; carbs: number; fat: number; serving_size: string; food_name: string; cooking_medium?: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; visibility?: string }) => Promise<{ isGoalHit: boolean }>;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [todayMacros, setTodayMacros] = useState<Macros>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [calorieGoal, setCalorieGoal] = useState<number>(2000);
    const [macroTargets, setMacroTargets] = useState<MacroTargets>({ protein: 150, carbs: 200, fat: 65 });
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
    const [isLoading, setIsLoading] = useState(false);

    const refreshToday = useCallback(async () => {
        if (!user) return;

        try {
            const data = await nutritionAPI.getToday();
            if (data?.logged) {
                setTodayMacros({
                    calories: data.logged.calories || 0,
                    protein: data.logged.protein || 0,
                    carbs: data.logged.carbs || 0,
                    fat: data.logged.fat || 0,
                });
                setLastUpdatedAt(Date.now());
            }

            // Also refresh profile for goal
            const profile = await nutritionAPI.getProfile();
            if (profile?.profile?.target_calories) {
                setCalorieGoal(profile.profile.target_calories);
                setMacroTargets({
                    protein: profile.profile.target_protein || 150,
                    carbs: profile.profile.target_carbs || 200,
                    fat: profile.profile.target_fat || 65,
                });
            }
        } catch (error) {
            // Silently fail - non-critical
        }
    }, [user?.id]);

    const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState<number>(4);

    // Initial load - only depend on user.id to prevent infinite re-renders
    useEffect(() => {
        if (user) {
            refreshToday();
            loadWeeklyGoal();
        }
    }, [user?.id]);

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
    const loadWeeklyGoal = async () => {
        try {
            const stored = await AsyncStorage.getItem(`weekly_goal_${user?.id}`);
            if (stored) {
                const n = parseInt(stored, 10);
                // Guard the parse: a corrupt key used to yield NaN, and
                // `workouts >= NaN` is false forever, so the goal could never
                // be met.
                if (Number.isFinite(n) && n > 0) {
                    setWeeklyWorkoutGoal(n);
                    return;
                }
            }

            const res = await workoutsAPI.getMySplits();
            const days = res?.splits?.[0]?.days_per_week;
            if (Number.isFinite(days) && days > 0) {
                setWeeklyWorkoutGoal(days);
            }
        } catch (e) {
            // Non-critical: the useState default of 4 stands.
        }
    };

    const updateWeeklyGoal = async (days: number) => {
        setWeeklyWorkoutGoal(days);
        try {
            if (user?.id) {
                await AsyncStorage.setItem(`weekly_goal_${user.id}`, String(days));
            }
        } catch (e) {
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

        const newMacros = {
            calories: previousMacros.calories + (food.calories || 0),
            protein: previousMacros.protein + (food.protein || 0),
            carbs: previousMacros.carbs + (food.carbs || 0),
            fat: previousMacros.fat + (food.fat || 0),
        };

        setTodayMacros(newMacros);
        setLastUpdatedAt(Date.now());

        const threshold = calorieGoal * 0.9;
        const isGoalHit = previousMacros.calories < threshold && newMacros.calories >= threshold;

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
