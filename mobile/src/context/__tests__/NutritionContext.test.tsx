import React from 'react';
import { AppState } from 'react-native';
import { NutritionProvider, useNutrition } from '../NutritionContext';
import { nutritionAPI, workoutsAPI, getAuthToken } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../services/api', () => ({ getAuthToken: jest.fn(async () => 'token-a'), nutritionAPI: { getToday: jest.fn(), logFood: jest.fn() }, workoutsAPI: { getMySplits: jest.fn() } }));
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
it('pins the food write to the session that started it', async () => {
    await mount(); await act(async () => { await value.logFoodOptimistic(food); });
    expect(nutritionAPI.logFood).toHaveBeenCalledWith(food, 'token-a');
});
it('clears yesterday at local midnight even when the new day cannot load', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23, 59, 59));
        await mount(); expect(value.todayMacros.calories).toBe(400);
        (nutritionAPI.getToday as jest.Mock).mockRejectedValue(new Error('Offline'));
        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(value.todayMacros).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('a meal logged on the new day never adds to yesterday while its save is pending', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23, 59, 59));
        await mount();
        jest.setSystemTime(new Date(2026, 9, 24, 0, 1));
        let resolve!: () => void;
        (nutritionAPI.logFood as jest.Mock).mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
        (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ logged: food, targets: null });
        let saved!: Promise<unknown>;
        await act(async () => { saved = value.logFoodOptimistic(food); });
        expect(value.todayMacros.calories).toBe(600);
        await act(async () => { resolve(); await saved; });
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('refreshes the local day when returning from an overnight background session', async () => {
    jest.useFakeTimers();
    const events = AppState.addEventListener as jest.Mock;
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23));
        await mount();
        (nutritionAPI.getToday as jest.Mock).mockRejectedValue(new Error('Offline'));
        jest.setSystemTime(new Date(2026, 9, 24, 8));
        const listener = events.mock.calls.find(([event]) => event === 'change')![1];
        await act(async () => listener('active'));
        expect(value.todayMacros.calories).toBe(0);
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('a response from yesterday cannot repopulate the totals after midnight', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23, 59, 59));
        await mount();
        let resolve!: (data: unknown) => void;
        (nutritionAPI.getToday as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
        let pending!: Promise<void>;
        await act(async () => { pending = value.refreshToday(); });
        (nutritionAPI.getToday as jest.Mock).mockRejectedValue(new Error('Offline'));
        await act(async () => { jest.advanceTimersByTime(2000); });
        await act(async () => { resolve({ logged, targets: null }); await pending; });
        expect(value.todayMacros.calories).toBe(0);
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('a pending token lookup cannot write after its account provider unmounts', async () => {
    await mount(); let resolve!: (token: string) => void;
    (getAuthToken as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const save = value.logFoodOptimistic(food).catch(error => error);
    await act(async () => screen.unmount());
    let result: any; await act(async () => { resolve('new-account-token'); result = await save; });
    expect(result.message).toContain('session changed'); expect(nutritionAPI.logFood).not.toHaveBeenCalled();
});
it('a delayed split read cannot overwrite a newly selected weekly workout goal', async () => {
    let resolve: any; (workoutsAPI.getMySplits as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await mount(); await act(async () => { await value.updateWeeklyGoal(5); });
    await act(async () => { resolve({ splits: [{ days_per_week: 2, is_active: true }] }); });
    expect(value.weeklyWorkoutGoal).toBe(5); expect(await AsyncStorage.getItem('weekly_goal_account-a')).toBe('5');
});
