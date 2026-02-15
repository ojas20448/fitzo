import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nutritionAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useXP } from './XPContext';

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface NutritionContextType {
    todayMacros: Macros;
    calorieGoal: number;
    weeklyWorkoutGoal: number;
    updateWeeklyGoal: (days: number) => Promise<void>;
    lastUpdatedAt: number;
    isLoading: boolean;
    refreshToday: () => Promise<void>;
    logFoodOptimistic: (food: { calories: number; protein: number; carbs: number; fat: number; serving_size: string; food_name: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' }) => Promise<{ isGoalHit: boolean }>;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { awardXP } = useXP();
    const [todayMacros, setTodayMacros] = useState<Macros>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [calorieGoal, setCalorieGoal] = useState<number>(2000);
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
            }
        } catch (error) {
            console.error('Failed to refresh nutrition:', error);
        }
    }, [user]);

    const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState<number>(4);

    // Initial load
    useEffect(() => {
        if (user) {
            refreshToday();
            loadWeeklyGoal();
        }
    }, [user, refreshToday]);

    const loadWeeklyGoal = async () => {
        try {
            const stored = await AsyncStorage.getItem(`weekly_goal_${user?.id}`);
            if (stored) {
                setWeeklyWorkoutGoal(parseInt(stored));
            }
        } catch (e) {
            console.warn('Failed to load weekly goal', e);
        }
    };

    const updateWeeklyGoal = async (days: number) => {
        setWeeklyWorkoutGoal(days);
        try {
            if (user?.id) {
                await AsyncStorage.setItem(`weekly_goal_${user.id}`, String(days));
            }
        } catch (e) {
            console.error('Failed to save weekly goal', e);
        }
    };



    const logFoodOptimistic = async (food: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        serving_size: string;
        food_name: string;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
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

        // Check for Goal Completion XP (Shadow of Effort)
        const threshold = calorieGoal * 0.9;
        const isGoalHit = previousMacros.calories < threshold && newMacros.calories >= threshold;

        if (isGoalHit) {
            setTimeout(() => {
                awardXP(100);
            }, 500);
        }

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
