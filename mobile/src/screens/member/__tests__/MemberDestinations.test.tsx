import React from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import FoodHomeScreen from '../FoodHomeScreen';
import GymHomeScreen from '../GymHomeScreen';
import WorkoutHistoryScreen from '../WorkoutHistoryScreen';
import FoodEntrySheet from '../../../components/FoodEntrySheet';
import ConfirmationSheet from '../../../components/ConfirmationSheet';
import { caloriesAPI, settingsAPI, workoutsAPI } from '../../../services/api';
import { localDiaryDate } from '../../../utils/foodDiary';
const { create, act } = jest.requireActual('react-test-renderer');
let mockAccount = 'a';
let mockDiaryParams: Record<string, string> = {};
const mockRefresh = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => false }, useLocalSearchParams: () => mockDiaryParams, useFocusEffect: (callback: any) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, refreshUser: jest.fn(async () => {}) }) }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ calorieGoal: null, macroTargets: null, refreshToday: mockRefresh }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }));
jest.mock('../../../services/api', () => ({
    caloriesAPI: { getDay: jest.fn() }, settingsAPI: { getGym: jest.fn(), joinGym: jest.fn(), leaveGym: jest.fn() },
    memberAPI: { getHome: jest.fn(async () => ({ crowd: { count: 5 } })) },
    checkinAPI: { getStatus: jest.fn(async () => ({ checked_in: false, gym_id: 'gym' })) },
    gymAPI: { getBusyTimes: jest.fn(async () => ({ busy_times: null })) },
    workoutsAPI: { getHistory: jest.fn() },
}));
let screen: any;
const entry = { id: 'meal', food_name: 'Rice', serving_size: '1 bowl', meal_type: 'lunch', calories: 200, protein: 4, carbs: 40, fat: 2, logged_date: '2026-10-23' };
const day = { entries: [entry], totals: { calories: 200, protein: 4, carbs: 40, fat: 2, entry_count: 1 } };
const copy = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const press = async (label: string) => {
    const node = screen.root.findAllByProps({ accessibilityLabel: label }).find((item: any) => typeof item.props.onPress === 'function');
    await act(async () => node.props.onPress());
};
beforeEach(() => {
    jest.clearAllMocks(); mockAccount = 'a'; mockDiaryParams = {};
    (caloriesAPI.getDay as jest.Mock).mockResolvedValue(day);
    (settingsAPI.getGym as jest.Mock).mockResolvedValue({ gym: null });
    (settingsAPI.joinGym as jest.Mock).mockResolvedValue({ gym: { id: 'gym', name: 'Gym' } });
    (settingsAPI.leaveGym as jest.Mock).mockResolvedValue({});
    (workoutsAPI.getHistory as jest.Mock).mockResolvedValue({ history: [] });
});
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });
it('opens a saved confirmation destination and lets the calendar choose another day', async () => {
    mockDiaryParams = { date: '2026-10-23' };
    await act(async () => { screen = create(<FoodHomeScreen />); });
    expect(caloriesAPI.getDay).toHaveBeenLastCalledWith('2026-10-23');
    expect(router.setParams).toHaveBeenCalledWith({ date: undefined });
    await press('Choose diary date'); await press('Previous month'); await press('Choose 2026-09-12');
    expect(caloriesAPI.getDay).toHaveBeenLastCalledWith('2026-09-12');
});

it('opens a target-free diary and edits a saved meal without a food search', async () => {
    await act(async () => { screen = create(<FoodHomeScreen />); });
    expect(caloriesAPI.getDay).toHaveBeenCalledWith(localDiaryDate());
    expect(copy()).toContain('Lunch'); expect(copy()).not.toContain('Your target:');
    await press('Edit Rice');
    expect(screen.root.findByType(FoodEntrySheet).props.entry.id).toBe('meal');
    await act(async () => screen.root.findByType(FoodEntrySheet).props.onChanged());
    expect(mockRefresh).toHaveBeenCalled();
});
it('distinguishes a failed food load from an empty diary and recovers on refresh', async () => {
    (caloriesAPI.getDay as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { screen = create(<FoodHomeScreen />); });
    expect(copy()).toContain('Could not refresh your food diary');
    expect(copy()).not.toContain('No food logged for this day.');
});
it('moves an open today diary to the next local date at midnight', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23, 59, 59));
        await act(async () => { screen = create(<FoodHomeScreen />); });
        (caloriesAPI.getDay as jest.Mock).mockClear();
        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(caloriesAPI.getDay).toHaveBeenCalledWith('2026-10-24');
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('keeps a deliberately selected historical date when midnight passes', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 23, 23, 59, 59));
        await act(async () => { screen = create(<FoodHomeScreen />); });
        await press('Previous day');
        (caloriesAPI.getDay as jest.Mock).mockClear();
        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(caloriesAPI.getDay).not.toHaveBeenCalled();
        expect(copy()).toContain('22');
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('shows each meal and lets an empty dinner section open food logging in that category', async () => {
    await act(async () => { screen = create(<FoodHomeScreen />); });
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) expect(copy()).toContain(meal);
    await press('Add dinner');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/log/calories', params: { date: localDiaryDate(), meal_type: 'dinner' } });
});
it('adds to the selected Friday and keeps that day open until Today is chosen', async () => {
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date(2026, 9, 25, 12));
        await act(async () => { screen = create(<FoodHomeScreen />); });
        await press('Previous day'); await press('Previous day');
        await press('Add dinner');
        expect(router.push).toHaveBeenLastCalledWith({ pathname: '/log/calories', params: { date: '2026-10-23', meal_type: 'dinner' } });
        expect(copy()).toContain('Friday');
        const add = screen.root.findAll((node: any) => node.props.title === 'Add food' && typeof node.props.onPress === 'function')[0];
        await act(async () => add.props.onPress());
        expect(router.push).toHaveBeenLastCalledWith({ pathname: '/log/calories', params: { date: '2026-10-23' } });
        expect(caloriesAPI.getDay).toHaveBeenLastCalledWith('2026-10-23');
        await press('Go to today');
        expect(caloriesAPI.getDay).toHaveBeenLastCalledWith('2026-10-25');
    } finally { await act(async () => screen.unmount()); screen = null; jest.useRealTimers(); }
});
it('never shows a late diary response from another account', async () => {
    let resolve!: (value: unknown) => void;
    (caloriesAPI.getDay as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ entries: [], totals: {} });
    await act(async () => { screen = create(<FoodHomeScreen />); });
    mockAccount = 'b'; await act(async () => screen.update(<FoodHomeScreen />));
    await act(async () => resolve(day));
    expect(copy()).not.toContain('Rice'); expect(copy()).toContain('No food logged for this day.');
});
it('does not join a gym just by opening the gym tab', async () => {
    await act(async () => { screen = create(<GymHomeScreen />); });
    expect(copy()).toContain('Join your gym'); expect(settingsAPI.joinGym).not.toHaveBeenCalled();
    const input = screen.root.findByType(TextInput);
    await act(async () => input.props.onChangeText(' club '));
    const button = screen.root.findAll((node: any) => node.props.title === 'Join gym')[0];
    await act(async () => button.props.onPress());
    expect(settingsAPI.joinGym).toHaveBeenCalledTimes(1); expect(settingsAPI.joinGym).toHaveBeenCalledWith('CLUB');
});
it('opens the gym scanner in join mode while keeping manual code entry available', async () => {
    await act(async () => { screen = create(<GymHomeScreen />); });
    await press('Scan gym QR code');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/qr-checkin', params: { mode: 'join' } });
    expect(screen.root.findByType(TextInput).props.accessibilityLabel).toBe('Gym access code');
    expect(settingsAPI.joinGym).not.toHaveBeenCalled();
});
it('keeps gym membership visible when optional attendance requests fail', async () => {
    (settingsAPI.getGym as jest.Mock).mockResolvedValue({ gym: { id: 'gym', name: 'My Club' } });
    const { checkinAPI } = require('../../../services/api'); checkinAPI.getStatus.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { screen = create(<GymHomeScreen />); });
    expect(copy()).toContain('My Club'); expect(copy()).toContain('Check-in status unavailable');
});
it('rejects a gym action retained from a previous account', async () => {
    await act(async () => { screen = create(<GymHomeScreen />); });
    await act(async () => screen.root.findByType(TextInput).props.onChangeText('CLUB'));
    const oldAction = screen.root.findAll((node: any) => node.props.title === 'Join gym')[0].props.onPress;
    mockAccount = 'b'; await act(async () => screen.update(<GymHomeScreen />));
    await act(async () => oldAction()); expect(settingsAPI.joinGym).not.toHaveBeenCalled();
});
it('confirms leaving a gym through the shared sheet and keeps membership on cancellation', async () => {
    (settingsAPI.getGym as jest.Mock).mockResolvedValue({ gym: { id: 'gym', name: 'My Club' } });
    await act(async () => { screen = create(<GymHomeScreen />); });
    const leave = screen.root.findAll((node: any) => node.props.title === 'Leave gym')[0];
    await act(async () => leave.props.onPress());
    expect(screen.root.findByType(ConfirmationSheet).props.action.title).toBe('Leave My Club?');
    expect(settingsAPI.leaveGym).not.toHaveBeenCalled();
    await act(async () => screen.root.findByType(ConfirmationSheet).props.onCancel());
    expect(screen.root.findByType(ConfirmationSheet).props.action).toBeNull();
    expect(copy()).toContain('My Club');
    await act(async () => leave.props.onPress());
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(settingsAPI.leaveGym).toHaveBeenCalledTimes(1);
});
it('keeps a failed gym-leave confirmation open with an inline retry message', async () => {
    (settingsAPI.getGym as jest.Mock).mockResolvedValue({ gym: { id: 'gym', name: 'My Club' } });
    (settingsAPI.leaveGym as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
    await act(async () => { screen = create(<GymHomeScreen />); });
    await act(async () => screen.root.findAll((node: any) => node.props.title === 'Leave gym')[0].props.onPress());
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(screen.root.findByType(ConfirmationSheet).props.action.message).toContain('Could not leave the gym. Please try again.');
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(settingsAPI.leaveGym).toHaveBeenCalledTimes(2);
    expect(screen.root.findByType(ConfirmationSheet).props.action).toBeNull();
});
it('shows real saved workout details without routing into a new workout', async () => {
    (workoutsAPI.getHistory as jest.Mock).mockResolvedValue({ history: [{ logged_date: '2026-10-22', workouts: [{ id: 'w', workout_type: 'push', completed: true, exercises: JSON.stringify([{ name: 'Chest Press', sets: [{ reps: 8, weight_kg: 40, completed: true }] }]) }] }] });
    await act(async () => { screen = create(<WorkoutHistoryScreen />); });
    await press('View push workout'); expect(copy()).toContain('Chest Press'); expect(copy()).toContain('40');
    expect(router.push).not.toHaveBeenCalled();
});
it('finds a saved workout by its exercise name and can clear an unmatched search', async () => {
    (workoutsAPI.getHistory as jest.Mock).mockResolvedValue({ history: [{ logged_date: '2026-10-22', workouts: [
        { id: 'push', workout_type: 'push', completed: true, exercises: JSON.stringify([{ name: 'Chest Press', sets: [{ reps: 8, weight_kg: 40, completed: true }] }]) },
        { id: 'pull', workout_type: 'pull', completed: true, exercises: JSON.stringify([{ name: 'Seated Row', sets: [{ reps: 10, weight_kg: 30, completed: true }] }]) },
    ] }] });
    await act(async () => { screen = create(<WorkoutHistoryScreen />); });
    const search = screen.root.findByProps({ accessibilityLabel: 'Search workout history' });
    await act(async () => search.props.onChangeText('seated row'));
    expect(copy()).toContain('Pull'); expect(copy()).not.toContain('Push');
    await act(async () => search.props.onChangeText('unknown movement'));
    expect(copy()).toContain('No matching workouts');
    await press('Clear workout search');
    expect(copy()).toContain('Push'); expect(copy()).toContain('Pull');
    expect(workoutsAPI.getHistory).toHaveBeenCalledTimes(1);
});
it('searches the readable workout title with spaces instead of its stored underscores', async () => {
    (workoutsAPI.getHistory as jest.Mock).mockResolvedValue({ history: [{ logged_date: '2026-10-22', workouts: [{ id: 'upper', workout_type: 'upper_1', completed: true, exercises: '[]' }] }] });
    await act(async () => { screen = create(<WorkoutHistoryScreen />); });
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Search workout history' }).props.onChangeText('Upper 1'));
    expect(copy()).toContain('Upper 1');
    expect(copy()).not.toContain('No matching workouts');
});
