import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import StatsScreen from '../StatsScreen';
import api from '../../../services/api';

const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
    router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }));
jest.mock('../../../components/AIConsentModal', () => ({ getAIConsent: async () => false }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ calorieGoal: 2000 }) }));
jest.mock('../../../services/api', () => ({ __esModule: true, default: { get: jest.fn() }, aiAPI: {} }));

let screen: any;
const control = (label: string) => screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label);
const copy = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const mount = async () => { await act(async () => { screen = create(<StatsScreen />); }); };
const press = async (label: string) => { await act(async () => control(label).props.onPress()); };

beforeEach(() => {
    jest.clearAllMocks();
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    (api.get as jest.Mock).mockImplementation(async (path: string) => ({
        data: path === '/nutrition/weekly' ? { history: [] } : { weeks: [], detailed: [], sessions_last_7d: 1 },
    }));
});
afterEach(async () => { await act(async () => screen?.unmount()); });

it('keeps back navigation above the scrolling content and returns to the previous screen', async () => {
    await mount();
    expect(copy()).toContain('Progress');
    expect(screen.root.findByType(ScrollView).findAllByProps({ accessibilityLabel: 'Back to profile' })).toHaveLength(0);
    await press('Back to profile');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
});

it('returns to Profile when Progress is opened without a navigation history', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    await mount();
    await press('Back to profile');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/profile');
    expect(router.back).not.toHaveBeenCalled();
});

it('switches between the heatmap and nutrition chart with accessible selected tabs', async () => {
    await mount();
    expect(control('Training').props.accessibilityState.selected).toBe(true);
    expect(copy()).toContain('Muscle Volume Status');
    expect(copy()).toContain('1 session');
    await press('Nutrition');
    expect(control('Nutrition').props.accessibilityRole).toBe('tab');
    expect(control('Nutrition').props.accessibilityState.selected).toBe(true);
    expect(control('Training').props.accessibilityState.selected).toBe(false);
    expect(copy()).toContain('Weekly Calories');
    expect(copy()).not.toContain('Muscle Volume Status');
    await press('Training');
    expect(copy()).toContain('Muscle Volume Status');
    expect(copy()).not.toContain('Weekly Calories');
    expect(api.get).toHaveBeenCalledTimes(2);
});
