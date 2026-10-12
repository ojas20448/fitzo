import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeScreen from '../HomeScreen';
import GlassCard from '../../../components/GlassCard';
import { intentAPI } from '../../../services/api';
let mockCalorieGoal: number | null = 2000;
let mockMacroTargets: { protein: number; carbs: number; fat: number } | null = { protein: 100, carbs: 250, fat: 60 };
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (cb: any) => jest.requireActual('react').useEffect(cb, [cb]) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Test', xp_points: 0 } }) }));
jest.mock('../../../context/NutritionContext', () => {
    const refreshToday = jest.fn();
    return { useNutrition: () => ({ todayMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, calorieGoal: mockCalorieGoal, macroTargets: mockMacroTargets, refreshToday }) };
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
    intentAPI: { setIntent: jest.fn(async () => ({})), getSuggestion: async () => ({ suggestion: { day_name: 'Push', day_index: 0, split_name: 'Push Pull Legs with a long name', split_id: 'ppl', split_days: ['Push'], days_per_week: 6 }, reason: 'long_break' }) },
    aiAPI: {}, checkinAPI: {}, gymAPI: {}, caloriesAPI: {},
    readinessAPI: { getToday: async () => ({ checked_in: false, readiness: null }) },
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
        const greeting = profile.findAllByType(Text).find((n: any) => n.props.children === 'Today');
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

it('starts the suggested workout from the main action and labels empty food logs clearly', async () => {
    let screen: any;
    await act(async () => { screen = create(<HomeScreen />); });
    try {
        const labels = screen.root.findAllByType(Text).map((node: any) => node.props.children);
        expect(labels).toContain('No food logged yet. Add a meal to see your progress.');
        expect(labels.indexOf('Food logged today')).toBeLessThan(labels.indexOf('Your coach'));
        const start = screen.root.findAllByProps({ accessibilityLabel: 'Start training' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => start.props.onPress());
        expect(intentAPI.setIntent).toHaveBeenCalledWith(expect.objectContaining({ session_label: 'Push', training_pattern: 'ppl' }));
        expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/log/workout' }));
    } finally { await act(async () => screen.unmount()); }
});

it('offers optional food setup and shows logged grams without fabricated targets', async () => {
    mockCalorieGoal = null; mockMacroTargets = null;
    let screen: any;
    await act(async () => { screen = create(<HomeScreen />); });
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Set up food targets' }).length).toBeGreaterThan(0);
    const copy = screen.root.findAllByType(Text).map((t: any) => t.props.children).flat().join(' ');
    expect(copy).not.toContain('Target 2000'); expect(copy).not.toContain(' / 100');
    await act(async () => screen.unmount());
    mockCalorieGoal = 2000; mockMacroTargets = { protein: 100, carbs: 250, fat: 60 };
});
