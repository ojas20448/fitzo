import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import WorkoutLogScreen from '../WorkoutLogScreen';
import { workoutsAPI } from '../../../services/api';
import ExerciseList from '../../../components/ExerciseList';
import { ExerciseCard } from '../../../components/workout';
import { buildStarterPlan } from '../../../utils/starterWorkout';
const { create, act } = jest.requireActual('react-test-renderer');
const mockParams: Record<string, string> = { intent: JSON.stringify({ session_label: 'Full Body A', training_pattern: 'full_body' }) };
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
let mockAccount = 'a';
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount } }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../../utils/firstRun', () => ({ hasSeenTip: async () => true, TIP_KEYS: {} }));
jest.mock('../../../hooks/useVoiceCapture', () => ({ useVoiceCapture: () => ({ stage: 'idle' }) }));
jest.mock('../../../services/api', () => ({
    workoutsAPI: { getLatest: jest.fn(), getMySplits: jest.fn(), log: jest.fn() },
    settingsAPI: { getWorkoutPreferences: async () => ({ workout_prefs_seen: true, warmup_card_enabled: false }), getSharingPreference: async () => ({ share_logs_default: false }) }, aiAPI: {},
}));
jest.mock('../../../components/ExerciseList', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../components/WorkoutDraftSheet', () => ({ WorkoutDraftSheet: () => null }));
jest.mock('../../../components/VoiceCaptureSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../components/workout', () => {
    const React = jest.requireActual('react'); const { Text } = jest.requireActual('react-native');
    return { ExerciseCard: ({ exercise }: any) => React.createElement(Text, null, exercise.name), WarmUpCard: () => null, WorkoutPrefsSheet: () => null,
        ScrollWheelPicker: () => null, RestTimerPill: () => null, WEIGHT_VALUES: [], REPS_VALUES: [], RIR_VALUES: [], REST_PRESETS: [], PICKER_HEIGHT: 200 };
});
let screen: any;
const plan = buildStarterPlan(['Full Body A'], { experience: 'new', equipment: 'gym', session_minutes: 20 }, 25);
const saved = { splits: [{ is_active: true, split_id: 'full_body', days: ['Full Body A'], training_plan: plan }] };
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const cards = () => screen.root.findAllByType(ExerciseCard);
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise(resolvePromise => { resolve = resolvePromise; }); return { promise, resolve }; };
beforeEach(() => {
    jest.clearAllMocks(); mockAccount = 'a'; delete mockParams.curatedExercises;
    mockParams.intent = JSON.stringify({ session_label: 'Full Body A', training_pattern: 'full_body' });
    (workoutsAPI.getLatest as jest.Mock).mockResolvedValue({ found: false });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue(saved);
});
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });
async function mount() { await act(async () => { screen = create(<WorkoutLogScreen />); }); }
test('opens the saved first workout with unchecked sets and requires actual completed work', async () => {
    await mount();
    expect(workoutsAPI.getLatest).toHaveBeenCalledWith('chest', 'Full Body A');
    expect(cards().map((node: any) => node.props.exercise.name)).toEqual(['Leg Press', 'Machine Chest Press', 'Lat Pulldown']);
    expect(cards().every((node: any) => node.props.exercise.sets.every((set: any) => !set.completed && set.weight_kg === ''))).toBe(true);
    const finish = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => String(item.props.children).toLowerCase().includes('finish')));
    await act(async () => finish.props.onPress());
    expect(workoutsAPI.log).not.toHaveBeenCalled(); expect(mockToast.error).toHaveBeenCalledWith('No completed sets', expect.any(String));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
    await act(async () => finish.props.onPress());
    expect(workoutsAPI.log).not.toHaveBeenCalled(); expect(mockToast.error).toHaveBeenCalledWith('Enter a weight', expect.any(String));
});
test('delayed setup cannot replace a manually added then removed exercise', async () => {
    const delayed = deferred(); (workoutsAPI.getMySplits as jest.Mock).mockReturnValueOnce(delayed.promise);
    await mount();
    const exercise = { id: 'own', name: 'My Exercise' };
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => item.props.children === 'Add Exercise'));
    await act(async () => add.props.onPress());
    await act(async () => screen.root.findByType(ExerciseList).props.onSelect(exercise));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.find(button => button.text === 'Remove')?.onPress?.(); });
    await act(async () => cards()[0].props.onRemoveExercise(0));
    alert.mockRestore();
    await act(async () => delayed.resolve(saved));
    expect(cards()).toHaveLength(0);
});
test('failed saved-plan loading is visible and retry can recover it', async () => {
    (workoutsAPI.getMySplits as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await mount(); expect(texts()).toContain('Some saved workout details could not load');
    const retry = screen.root.findAllByProps({ accessibilityLabel: 'Retry loading workout' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => retry.props.onPress());
    expect(cards()).toHaveLength(3); expect(texts()).not.toContain('Some saved workout details could not load');
});
test('a curated template takes priority and does not trigger automatic setup requests', async () => {
    mockParams.curatedExercises = JSON.stringify([{ id: 'own', name: 'Chosen Template Exercise', sets: [{ id: 'set', reps: 8, weight_kg: '', completed: false }] }]);
    await mount(); expect(cards()[0].props.exercise.name).toBe('Chosen Template Exercise');
    expect(workoutsAPI.getMySplits).not.toHaveBeenCalled(); expect(workoutsAPI.getLatest).not.toHaveBeenCalled();
});
test('responses for an old account cannot populate the new account workout', async () => {
    const delayed = deferred(); (workoutsAPI.getMySplits as jest.Mock).mockReturnValueOnce(delayed.promise).mockResolvedValueOnce({ splits: [] });
    await mount(); mockAccount = 'b'; await act(async () => screen.update(<WorkoutLogScreen />));
    await act(async () => delayed.resolve(saved)); expect(cards()).toHaveLength(0);
});
