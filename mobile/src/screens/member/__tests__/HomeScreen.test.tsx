import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import HomeScreen from '../HomeScreen';
import GlassCard from '../../../components/GlassCard';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (cb: any) => jest.requireActual('react').useEffect(cb, [cb]) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Test', xp_points: 0 } }) }));
jest.mock('../../../context/NutritionContext', () => {
    const refreshToday = jest.fn();
    return { useNutrition: () => ({ todayMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, calorieGoal: 2000, macroTargets: { protein: 100, carbs: 250, fat: 60 }, refreshToday }) };
});
jest.mock('../../../services/healthService', () => ({ isHealthAvailable: () => false }));
jest.mock('../../../services/healthSync', () => ({ syncHealthDays: jest.fn() }));
jest.mock('../../../services/api', () => ({
    memberAPI: { getHome: async () => ({
        user: { name: 'Test', avatar_url: null, xp_points: 0 },
        gym: { name: 'A long gym name that should shrink before the percentage' },
        crowd: { level: 'low', count: 0, capacity: 50, percentage: 0 },
        checkin: { status: 'not_checked_in', checked_in_at: null }, intent: null,
        streak: { current: 0, best: 0, history: [] },
    }) },
    workoutsAPI: { getToday: async () => ({ workouts: [] }), getFeed: async () => ({ feed: [] }) },
    friendsAPI: { getFriends: async () => ({ friends: [] }) },
    intentAPI: { getSuggestion: async () => ({ suggestion: { day_name: 'Push', day_index: 0, split_name: 'Push Pull Legs with a long name', split_id: 'ppl', split_days: ['Push'], days_per_week: 6 }, reason: 'long_break' }) },
    aiAPI: {}, checkinAPI: {}, gymAPI: {}, caloriesAPI: {},
}));
it('insets the gym occupancy content from the card edge, including the percentage and live dot', async () => {
    let screen: any;
    await act(async () => { screen = create(<HomeScreen />); });
    try {
        const card = screen.root.findAllByType(GlassCard).find((n: any) => n.findAllByType(Text).some((t: any) => Array.isArray(t.props.children) && t.props.children.includes(' training now')));
        expect(card).toBeDefined();
        expect(StyleSheet.flatten(card.props.style).padding ?? 0).toBeGreaterThanOrEqual(12);
        const fill = card.findAllByType(View).find((n: any) => StyleSheet.flatten(n.props.style)?.height === '100%');
        expect(StyleSheet.flatten(fill.props.style).width).toBe('0%');
    } finally { await act(async () => screen.unmount()); }
});

it('lets the greeting shrink instead of pushing the home header actions off-screen', async () => {
    let screen: any;
    await act(async () => { screen = create(<HomeScreen />); });
    try {
        const profile = screen.root.findAllByProps({ accessibilityLabel: 'View profile' }).find((n: any) => typeof n.props.onPress === 'function');
        expect(StyleSheet.flatten(profile.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
        const greeting = profile.findAllByType(Text).find((n: any) => n.props.children === 'Consistency matters.');
        expect(greeting.props.numberOfLines).toBe(1);
    } finally { await act(async () => screen.unmount()); }
});

it('keeps a long training-plan label from overlapping the start action', async () => {
    let screen: any;
    await act(async () => { screen = create(<HomeScreen />); });
    try {
        const plan = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'Push Pull Legs with a long name');
        expect(plan.props.numberOfLines).toBe(1);
        expect(StyleSheet.flatten(plan.parent.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    } finally { await act(async () => screen.unmount()); }
});
