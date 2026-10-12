import React from 'react';
import { NutritionProvider, useNutrition } from '../NutritionContext';
import { nutritionAPI, workoutsAPI } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../services/api', () => ({ nutritionAPI: { getToday: jest.fn(), logFood: jest.fn() }, workoutsAPI: { getMySplits: jest.fn() } }));
let value: ReturnType<typeof useNutrition>;
let screen: any;
const Probe = () => { value = useNutrition(); return null; };
const logged = { calories: 400, protein: 15, carbs: 50, fat: 10 };
const food = { food_name: 'Example meal', serving_size: '1 serving', calories: 600, protein: 30, carbs: 80, fat: 20, meal_type: 'lunch' as const };
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ logged, targets: null }); (nutritionAPI.logFood as jest.Mock).mockResolvedValue({}); (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [] }); });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; });
const mount = async () => { await act(async () => { screen = create(<NutritionProvider><Probe /></NutritionProvider>); }); };
it('keeps totals usable without inventing calorie or macro targets or a goal-hit celebration', async () => {
    await mount(); expect(value.calorieGoal).toBeNull(); expect(value.macroTargets).toBeNull(); expect(value.todayMacros).toEqual(logged);
    let result: any; await act(async () => { result = await value.logFoodOptimistic(food); });
    expect(result.isGoalHit).toBe(false);
});
it('preserves real zero macro targets and uses only returned goals', async () => {
    (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ logged, targets: { calories: 1000, protein: 100, carbs: 0, fat: 0 } });
    await mount(); expect(value.calorieGoal).toBe(1000); expect(value.macroTargets).toEqual({ protein: 100, carbs: 0, fat: 0 });
    let result: any; await act(async () => { result = await value.logFoodOptimistic(food); }); expect(result.isGoalHit).toBe(true);
});
it('an older refresh cannot overwrite newer totals or targets', async () => {
    await mount(); let resolve: any;
    (nutritionAPI.getToday as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    let old: Promise<void>; await act(async () => { old = value.refreshToday(); });
    (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ logged: { ...logged, calories: 900 }, targets: null });
    await act(async () => { await value.refreshToday(); });
    await act(async () => { resolve({ logged, targets: { calories: 2000, protein: 150, carbs: 200, fat: 65 } }); await old; });
    expect(value.todayMacros.calories).toBe(900); expect(value.calorieGoal).toBeNull();
});
it('failed food saves restore totals and preserve the original error', async () => {
    await mount(); const failure = new Error('Food save failed');
    (nutritionAPI.logFood as jest.Mock).mockRejectedValueOnce(failure);
    let caught: unknown; await act(async () => { try { await value.logFoodOptimistic(food); } catch (error) { caught = error; } });
    expect(caught).toBe(failure); expect(value.todayMacros).toEqual(logged); expect(value.calorieGoal).toBeNull();
});
it('a delayed split read cannot overwrite a newly selected weekly workout goal', async () => {
    let resolve: any; (workoutsAPI.getMySplits as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await mount(); await act(async () => { await value.updateWeeklyGoal(5); });
    await act(async () => { resolve({ splits: [{ days_per_week: 2, is_active: true }] }); });
    expect(value.weeklyWorkoutGoal).toBe(5); expect(await AsyncStorage.getItem('weekly_goal_account-a')).toBe('5');
});
