import React from 'react';
import { Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import CalorieLogScreen from '../CalorieLogScreen';
import { foodAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');

jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), canGoBack: () => false, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../utils/firstRun', () => ({ hasSeenTip: async () => true, TIP_KEYS: {} }));
jest.mock('../../../hooks/useVoiceCapture', () => ({ useVoiceCapture: () => ({ isBusy: false }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ refreshToday: jest.fn(), logFoodOptimistic: jest.fn() }) }));
jest.mock('../../../services/FoodCacheService', () => ({ FoodCacheService: { searchLocal: async () => [] } }));
jest.mock('../../../services/api', () => ({
    caloriesAPI: { getToday: async () => ({ entries: [{ id: 'meal', food_name: 'Lunch', calories: 400 }] }), getFrequentFoods: async () => ({ frequent: [] }) },
    settingsAPI: { getSharingPreference: async () => ({ share_logs: false }) },
    nutritionAPI: { getPresets: async () => ({ presets: [{ id: 'veg', name: 'Veg Thali', emoji: '🍛', items: [{ name: 'Rice', calories: 130 }] }] }) },
    foodAPI: { search: jest.fn() },
}));

let screen: any;
const texts = () => screen.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ');
beforeEach(() => { jest.useFakeTimers(); });
afterEach(async () => { await act(async () => screen?.unmount()); jest.useRealTimers(); });
async function open() { await act(async () => { screen = create(<CalorieLogScreen />); }); }
async function search(value: string) {
    await act(async () => { screen.root.findByProps({ placeholder: 'Search foods...' }).props.onChangeText(value); });
    await act(async () => { jest.advanceTimersByTime(300); });
}

it('keeps quick-add and the existing meal log in one scrollable flow without an intervening fork prompt', async () => {
    await open();
    expect(texts()).not.toContain('Search for a food');
    const lunch = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'Lunch');
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
    const title = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'QUICK MEALS');
    expect(StyleSheet.flatten(title.parent.props.style).paddingHorizontal ?? 0).toBeGreaterThanOrEqual(12);
});
