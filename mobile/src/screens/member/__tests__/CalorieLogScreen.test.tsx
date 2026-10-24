import React from 'react';
import { Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import CalorieLogScreen from '../CalorieLogScreen';
import { foodAPI, caloriesAPI, nutritionAPI } from '../../../services/api';
import { FoodDraftSheet } from '../../../components/FoodDraftSheet';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { create, act } = jest.requireActual('react-test-renderer');
const mockSave = jest.fn(async (_food: any) => ({ isGoalHit: false }));
const mockToast = { error: jest.fn(), success: jest.fn() };
const mockRequestAIConsent = jest.fn(async () => true);
let mockAccount = 'a';
let mockParams: Record<string, string> = {};

jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), canGoBack: () => false, replace: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../utils/firstRun', () => ({ hasSeenTip: async () => true, TIP_KEYS: {} }));
jest.mock('../../../hooks/useVoiceCapture', () => ({ useVoiceCapture: () => ({ isBusy: false, requestAIConsent: mockRequestAIConsent }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ refreshToday: jest.fn(), logFoodOptimistic: mockSave }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount } }) }));
jest.mock('../../../services/FoodCacheService', () => ({ FoodCacheService: { searchLocal: async () => [] } }));
jest.mock('../../../services/api', () => ({
    caloriesAPI: { getToday: jest.fn(async () => ({ entries: [{ id: 'meal', food_name: 'Lunch', calories: 400 }] })), getDay: jest.fn(async () => ({ entries: [{ id: 'friday-meal', food_name: 'Friday rice', calories: 200 }] })), getFrequentFoods: jest.fn(async () => ({ frequent: [] })) },
    settingsAPI: { getSharingPreference: async () => ({ share_logs: false }) },
    nutritionAPI: { logBulk: jest.fn(async () => ({})), getPresets: async () => ({ presets: [{ id: 'veg', name: 'Veg Thali', emoji: '🍛', items: [{ name: 'Rice', calories: 130 }] }] }) },
    foodAPI: { search: jest.fn(), analyzeText: jest.fn(async () => ({ food: null })) },
}));

let screen: any;
const texts = () => screen.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ');
beforeEach(async () => { jest.useFakeTimers(); jest.clearAllMocks(); mockAccount = 'a'; mockParams = {}; await AsyncStorage.clear(); mockSave.mockResolvedValue({ isGoalHit: false }); (caloriesAPI.getFrequentFoods as jest.Mock).mockResolvedValue({ frequent: [] }); });
afterEach(async () => { await act(async () => screen?.unmount()); jest.useRealTimers(); });
async function open() { await act(async () => { screen = create(<CalorieLogScreen />); }); }
it('distinguishes failed meal loading from an empty log and retries', async () => {
    (caloriesAPI.getToday as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await open();
    expect(texts()).toContain('Could not refresh');
    expect(texts()).not.toContain('No meals logged today');
    const retry = screen.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAllByType(Text).some((text: any) => text.props.children === 'Try again'))[0];
    await act(async () => retry.props.onPress());
    expect(texts()).toContain('Lunch');
    expect(texts()).not.toContain('Could not refresh');
});
async function search(value: string) {
    await act(async () => { screen.root.findByProps({ placeholder: 'Search foods...' }).props.onChangeText(value); });
    await act(async () => { jest.advanceTimersByTime(300); });
}

it.each([false, true])('only sends a text food estimate after the shared permission returns %s', async (granted) => {
    let decide!: (value: boolean) => void;
    mockRequestAIConsent.mockReturnValueOnce(new Promise<boolean>(resolve => { decide = resolve; }));
    (foodAPI.search as jest.Mock).mockResolvedValueOnce({ foods: [] });
    await open();
    await search('a meal description');
    const estimate = screen.root.findAll((node: any) => typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some((text: any) => text.props.children === 'Ask AI: "a meal description"'))[0];
    await act(async () => { void estimate.props.onPress(); });
    expect(mockRequestAIConsent).toHaveBeenCalledTimes(1);
    expect(foodAPI.analyzeText).not.toHaveBeenCalled();
    await act(async () => { decide(granted); });
    expect(foodAPI.analyzeText).toHaveBeenCalledTimes(granted ? 1 : 0);
    if (granted) expect(foodAPI.analyzeText).toHaveBeenCalledWith('a meal description');
});

it('keeps quick-add and the existing meal log in one scrollable flow without an intervening fork prompt', async () => {
    await open();
    expect(texts()).not.toContain('Search for a food');
    const lunch = screen.root.findAllByProps({ accessibilityLabel: 'Lunch, 400 calories. Tap to edit or delete.' })[0];
    const ancestors: any[] = [];
    for (let node = lunch.parent; node; node = node.parent) ancestors.push(node);
    expect(ancestors.some(n => n.type === ScrollView && !n.props.horizontal && n.findAllByType(Text).some((t: any) => t.props.children === 'QUICK ADD'))).toBe(true);
});

it('keeps local matches visible while the remote catalogue is loading, without the idle meal log', async () => {
    (foodAPI.search as jest.Mock).mockImplementation(() => new Promise(() => {}));
    await open();
    await search('banana');
    expect(texts()).toContain('Banana');
    expect(texts()).not.toContain("TODAY'S LOG");
});

it('ignores an old catalogue response after clearing the search', async () => {
    let finish!: (value: any) => void;
    (foodAPI.search as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await open();
    await search('old-query');
    await act(async () => { screen.root.findByType(TextInput).props.onChangeText(''); });
    await act(async () => { finish({ foods: [{ id: 'stale', name: 'Stale food', description: '100 kcal' }] }); });
    expect(texts()).not.toContain('Stale food');
    expect(texts()).toContain('Lunch');
});

it('aligns the quick-meal section with the rest of the food screen instead of touching the screen edge', async () => {
    await open();
    const title = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'MEAL IDEAS');
    expect(StyleSheet.flatten(title.parent.props.style).paddingHorizontal ?? 0).toBeGreaterThanOrEqual(12);
});

const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
async function repeatFood(portion = '250g', meal = 'Lunch') {
    (caloriesAPI.getFrequentFoods as jest.Mock).mockResolvedValue({ frequent: [{ entry_id: 'last', name: 'Dal', serving_size: portion, calories: 310, protein: 15, carbs: 42, fat: 9, meal_type: 'lunch' }] });
    await open();
    await act(async () => button(`Add to ${meal.toLowerCase()}`).props.onPress());
    const dal = screen.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t: any) => t.props.children === 'Dal'))[0];
    await act(async () => dal.props.onPress());
}
it('lets a member choose breakfast before repeating a food previously logged for lunch', async () => {
    await repeatFood('250g', 'Breakfast');
    expect(button('breakfast').props['aria-checked']).toBe(true);
    await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ meal_type: 'breakfast', food_name: 'Dal' }));
    expect(texts()).toContain('Lunch'); // Legacy entries without a category remain accessible.
});
it('keeps the selected meal in camera navigation and voice review logging', async () => {
    mockParams = { meal_type: 'dinner', date: '2026-10-23' };
    await open();
    expect(button('Add to dinner').props['aria-checked']).toBe(true);
    await act(async () => button('Scan food photo').props.onPress());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/food-scanner', params: { meal_type: 'dinner', date: '2026-10-23' } });
    await act(async () => screen.root.findByType(FoodDraftSheet).props.onConfirm([{ name: 'Dal', calories: 200, protein: 12 }]));
    expect(nutritionAPI.logBulk).toHaveBeenCalledWith([expect.objectContaining({ meal_name: 'Dal', calories: 200 })], 'dinner', undefined, '2026-10-23');
});
it('loads and saves quick-add food on the selected Friday', async () => {
    jest.setSystemTime(new Date(2026, 9, 25, 12));
    mockParams = { date: '2026-10-23' };
    await repeatFood();
    expect(caloriesAPI.getDay).toHaveBeenCalledWith('2026-10-23');
    expect(caloriesAPI.getToday).not.toHaveBeenCalled();
    expect(texts()).toContain('Friday rice');
    expect(texts()).not.toContain("TODAY'S LOG");
    await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ logged_date: '2026-10-23', food_name: 'Dal' }));
});
it('saves the actual repeat portion and chosen meal, then stays in the flow for another food', async () => {
    await repeatFood();
    expect(texts()).toContain('Last saved portion'); expect(texts()).not.toContain('Average Entry');
    expect(button('lunch').props['aria-checked']).toBe(true);
    await act(async () => button('dinner').props.onPress());
    expect(button('lunch').props['aria-checked']).toBe(false); expect(button('dinner').props['aria-checked']).toBe(true);
    await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ food_name: 'Dal', serving_size: '250g', calories: 310, protein: 15, meal_type: 'dinner' }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(button('Add another food')).toBeTruthy(); expect(button('Done logging food')).toBeTruthy();
    await act(async () => button('Add another food').props.onPress());
    await search('banana');
    const banana = screen.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t: any) => t.props.children === 'Banana'))[0];
    await act(async () => banana.props.onPress()); await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenLastCalledWith(expect.objectContaining({ food_name: 'Banana', meal_type: 'dinner' }));
    await act(async () => button('Done logging food').props.onPress()); expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});
it('does not offer an invented gram conversion and retains the draft on save failure', async () => {
    await repeatFood('1 bowl');
    expect(texts()).not.toContain('Grams');
    mockSave.mockRejectedValueOnce(new Error('Offline'));
    await act(async () => button('Save food').props.onPress());
    expect(button('Save food').props.accessibilityState.disabled).toBe(false);
    expect(button('Add another food')).toBeUndefined();
    expect(mockToast.error).toHaveBeenCalledWith('Error', 'Offline');
    await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenLastCalledWith(expect.objectContaining({ serving_size: '1 bowl', meal_type: 'lunch' }));
});
it('converts grams against the actual previous portion instead of an assumed 100g base', async () => {
    await repeatFood('250g');
    const grams = screen.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t: any) => t.props.children === 'Grams'))[0];
    await act(async () => grams.props.onPress());
    await act(async () => screen.root.findByProps({ placeholder: '100' }).props.onChangeText('100'));
    await act(async () => button('Save food').props.onPress());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ serving_size: '100g', calories: 124, protein: 6, meal_type: 'lunch' }));
});
it('rapid taps cannot submit the same food twice while the first save is in flight', async () => {
    await repeatFood(); let resolve!: (value: any) => void;
    mockSave.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const save = button('Save food').props.onPress;
    await act(async () => { void save(); void save(); });
    expect(mockSave).toHaveBeenCalledTimes(1); expect(button('Save food').props.disabled).toBe(true);
    await act(async () => { resolve({ isGoalHit: false }); }); expect(button('Add another food')).toBeTruthy();
});
it('account changes discard a previous account\'s shortcut list and open food draft', async () => {
    await AsyncStorage.setItem('custom_quick_adds_a', JSON.stringify([{ id: 'own', name: 'Private shortcut', calories: 100 }]));
    await repeatFood(); expect(texts()).toContain('Private shortcut');
    mockAccount = 'b'; await act(async () => screen.update(<CalorieLogScreen />));
    expect(texts()).not.toContain('Private shortcut'); expect(button('Save food')).toBeUndefined();
});
