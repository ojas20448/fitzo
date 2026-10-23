import React from 'react';
import { Text, TextInput, FlatList } from 'react-native';
import { router } from 'expo-router';
import PublishedSplitsScreen from '../PublishedSplitsScreen';
import { workoutsAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
const mockToast = { error: jest.fn(), success: jest.fn() };
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' }, token: 'token' }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../../components/PublishSplitModal', () => () => null);
jest.mock('../../../services/api', () => ({ workoutsAPI: { getPublishedSplits: jest.fn(), getPublishedSplit: jest.fn(), setSplitHeart: jest.fn(), adoptSplit: jest.fn() } }));
const plan = { id: 'one', name: 'Upper strength', description: 'Build strength', days_per_week: 3, difficulty_level: 'beginner', tags: ['strength'], author_name: 'Alex', is_official: false, heart_count: 12, liked: false, download_count: 4, has_exercises: true, created_at: '2026-10-23', program_structure: { 'Day 1': 'Upper' }, training_plan: { version: 2, type: 'custom', sessions: [{ day_name: 'Upper', exercises: [{ name: 'Chest Press', set_count: 3, reps_min: 8, reps_max: 12 }] }] } };
let screen: any;
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => { await act(async () => { await control(label).props.onPress(); }); };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => { jest.clearAllMocks(); (workoutsAPI.getPublishedSplits as jest.Mock).mockReset().mockResolvedValue({ splits: [plan], has_more: false }); (workoutsAPI.getPublishedSplit as jest.Mock).mockResolvedValue({ split: plan }); });
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; jest.useRealTimers(); });
const mount = async () => { await act(async () => { screen = create(<PublishedSplitsScreen />); }); };

test('combines collection, days, level, search and sort, then clears filters without changing the collection', async () => {
    jest.useFakeTimers(); await mount();
    expect(workoutsAPI.getPublishedSplits).toHaveBeenLastCalledWith(expect.objectContaining({ official: true, sort: 'most_liked', page: 0 }), 'token');
    await press('Community Workouts'); await press('Workout filters'); await press('3 training days'); await press('Beginner workouts');
    await act(async () => { screen.root.findByType(TextInput).props.onChangeText('  strength  '); jest.advanceTimersByTime(300); });
    // The debounce is scheduled after the input render.
    await act(async () => jest.advanceTimersByTime(300));
    await press('Sort by newest');
    expect(workoutsAPI.getPublishedSplits).toHaveBeenLastCalledWith(expect.objectContaining({ official: false, days: 3, difficulty: 'beginner', search: 'strength', sort: 'newest', page: 0 }), 'token');
    await press('Clear all workout filters');
    expect(workoutsAPI.getPublishedSplits).toHaveBeenLastCalledWith(expect.objectContaining({ official: false, days: undefined, difficulty: undefined, search: undefined }), 'token');
});

test('ignores an older collection response after switching tabs', async () => {
    const old = deferred(); (workoutsAPI.getPublishedSplits as jest.Mock).mockReturnValueOnce(old.promise);
    await mount(); await press('Community Workouts');
    await act(async () => old.resolve({ splits: [{ ...plan, id: 'old', name: 'Stale Fitzo result' }] }));
    expect(texts()).toContain('Upper strength'); expect(texts()).not.toContain('Stale Fitzo result');
});

test('keeps pagination retry on the same filters and deduplicates results', async () => {
    (workoutsAPI.getPublishedSplits as jest.Mock).mockResolvedValueOnce({ splits: [plan], has_more: true }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ splits: [plan, { ...plan, id: 'two', name: 'Lower strength' }], has_more: false });
    await mount(); await press('Load more workouts'); await press('Retry workouts');
    expect(workoutsAPI.getPublishedSplits).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, official: true }), 'token');
    expect(screen.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['one', 'two']);
    expect(texts()).toContain('Lower strength');
});

test('blocks double hearts and preserves the saved choice after a network failure', async () => {
    const pending = deferred(); (workoutsAPI.setSplitHeart as jest.Mock).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('offline'));
    await mount();
    await act(async () => { control('Heart Upper strength').props.onPress(); control('Heart Upper strength').props.onPress(); });
    expect(workoutsAPI.setSplitHeart).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ liked: true, heart_count: 13 }));
    expect(control('Unheart Upper strength').props.accessibilityState.selected).toBe(true);
    await press('Unheart Upper strength'); expect(control('Unheart Upper strength')).toBeTruthy(); expect(mockToast.error).toHaveBeenCalled();
});

test('previews actual exercises and waits for adoption once before navigating', async () => {
    const pending = deferred(); (workoutsAPI.adoptSplit as jest.Mock).mockReturnValueOnce(pending.promise);
    await mount(); await press('Preview Upper strength'); expect(texts()).toContain('Chest Press');
    await act(async () => { control('Use this plan').props.onPress(); control('Use this plan').props.onPress(); });
    expect(workoutsAPI.adoptSplit).toHaveBeenCalledTimes(1); expect(workoutsAPI.adoptSplit).toHaveBeenCalledWith('one', 'token'); expect(router.replace).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ user_split: { split_id: 'adopted_one', name: plan.name, days: ['Upper'], days_per_week: 1 } }));
    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/workout-intent' }));
});

test('a pending heart respects a newer sort choice when its response arrives', async () => {
    const pending = deferred();
    const newer = { ...plan, id: 'two', name: 'New split', created_at: '2026-10-24', heart_count: 1 };
    (workoutsAPI.getPublishedSplits as jest.Mock).mockResolvedValueOnce({ splits: [plan, newer] }).mockResolvedValueOnce({ splits: [newer, plan] });
    (workoutsAPI.setSplitHeart as jest.Mock).mockReturnValueOnce(pending.promise);
    await mount(); await act(async () => { control('Heart Upper strength').props.onPress(); }); await press('Sort by newest');
    await act(async () => pending.resolve({ liked: true, heart_count: 13 }));
    expect(screen.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['two', 'one']);
});

test('offers a retry on load failure and explains empty filtered results', async () => {
    (workoutsAPI.getPublishedSplits as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ splits: [], has_more: false });
    await mount(); await press('Retry workouts'); await press('Workout filters'); await press('7 training days');
    expect(texts()).toContain('No matching workouts'); await press('Reset workout filters'); expect(texts()).toContain('No workouts here yet');
});
