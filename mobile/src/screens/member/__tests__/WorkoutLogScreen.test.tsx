import React from 'react';
import { AppState, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { workoutInputModeKey } from '../../../hooks/useWorkoutInputMode';
import WorkoutLogScreen from '../WorkoutLogScreen';
import { workoutsAPI, exerciseAPI } from '../../../services/api';
import ExerciseList from '../../../components/ExerciseList';
import WorkoutCategorySheet from '../../../components/workout/WorkoutCategorySheet';
import ConfirmationSheet from '../../../components/ConfirmationSheet';
import WorkoutExercisesSheet from '../../../components/workout/WorkoutExercisesSheet';
import WorkoutSetEditor from '../../../components/workout/WorkoutSetEditor';
import { ExerciseCard, RestTimerPill } from '../../../components/workout';
import { buildStarterPlan } from '../../../utils/starterWorkout';
import { customWorkoutPlan } from '../../../utils/__tests__/fixtures/customWorkoutPlan';
import { activeWorkoutDraftKey, saveActiveWorkoutDraft } from '../../../utils/activeWorkoutDraft';
import { syncWorkoutActivity } from '../../../services/workoutActivity';
const { create, act } = jest.requireActual('react-test-renderer');
const mockParams: Record<string, string> = { intent: JSON.stringify({ session_label: 'Full Body A', training_pattern: 'full_body' }) };
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
let mockAccount = 'a';
let mockRestEnabled = false;
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) }, useLocalSearchParams: () => mockParams }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, token: 'test-token' }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../../utils/firstRun', () => ({ hasSeenTip: async () => true, TIP_KEYS: {} }));
jest.mock('../../../hooks/useVoiceCapture', () => ({ useVoiceCapture: () => ({ stage: 'idle' }) }));
jest.mock('../../../services/workoutActivity', () => ({ syncWorkoutActivity: jest.fn(async () => {}) }));
jest.mock('../../../services/api', () => ({
    workoutsAPI: { getLatest: jest.fn(), getMySplits: jest.fn(), log: jest.fn(), updateRoutine: jest.fn() },
    exerciseAPI: { getById: jest.fn(async () => ({ exercise: { id: 'press', name: 'Chest Press' } })) },
    settingsAPI: { getWorkoutPreferences: async () => ({ workout_prefs_seen: true, warmup_card_enabled: false, rest_timer_enabled: mockRestEnabled }), getSharingPreference: async () => ({ share_logs_default: false }) }, aiAPI: {},
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
beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks(); mockAccount = 'a'; mockRestEnabled = false; delete mockParams.curatedExercises; delete mockParams.start; delete mockParams.addExerciseId; delete mockParams.editExercises;
    (workoutsAPI.log as jest.Mock).mockReset();
    (workoutsAPI.updateRoutine as jest.Mock).mockReset();
    mockParams.intent = JSON.stringify({ session_label: 'Full Body A', training_pattern: 'full_body' });
    (workoutsAPI.getLatest as jest.Mock).mockResolvedValue({ found: false });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue(saved);
});
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });
async function mount() { await act(async () => { screen = create(<WorkoutLogScreen />); }); }

test('adding rest time advances the deadline so later countdown ticks preserve the extra seconds', async () => {
    jest.useFakeTimers(); mockRestEnabled = true;
    try {
        await mount();
        await act(async () => { cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 40); cards()[0].props.onUpdateSet(0, 0, 'completed', true); });
        await act(async () => jest.advanceTimersByTime(0));
        const timer = () => screen.root.findByType(RestTimerPill);
        const initial = timer().props.seconds;
        await act(async () => timer().props.onAddSeconds(30));
        await act(async () => jest.advanceTimersByTime(1000));
        expect(timer().props.seconds).toBe(initial + 29);
        await act(async () => screen.unmount()); screen = null;
    } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});

const pressAction = async (label: string) => { await act(async () => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function').props.onPress()); };
async function changedRoutine() {
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValueOnce({ splits: [{ ...saved.splits[0], id: '11111111-1111-4111-8111-111111111111', name: 'My plan' }] });
    (workoutsAPI.log as jest.Mock).mockResolvedValue({ prs: [] });
    await mount();
    await act(async () => { cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 40); cards()[0].props.onUpdateSet(0, 0, 'completed', true); cards()[0].props.onAddSet(0); });
    await pressAction('Finish workout');
    expect(texts()).toContain('Keep these routine changes?');
}
test('saving today only preserves the saved routine and logs completed sets once', async () => {
    await changedRoutine(); await pressAction('Save today only');
    expect(workoutsAPI.updateRoutine).not.toHaveBeenCalled(); expect(workoutsAPI.log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((workoutsAPI.log as jest.Mock).mock.calls[0][0].exercises);
    expect(payload[0].sets).toHaveLength(1);
});
test('updating the routine finishes only after its save succeeds and rejects duplicate taps', async () => {
    await changedRoutine(); const pending = deferred(); (workoutsAPI.updateRoutine as jest.Mock).mockReturnValue(pending.promise);
    await act(async () => { const action = screen.root.findAllByProps({ accessibilityLabel: 'Update routine & save workout' }).find((n: any) => typeof n.props.onPress === 'function'); action.props.onPress(); action.props.onPress(); });
    expect(workoutsAPI.updateRoutine).toHaveBeenCalledTimes(1); expect(workoutsAPI.log).not.toHaveBeenCalled();
    const args = (workoutsAPI.updateRoutine as jest.Mock).mock.calls[0]; expect(args[2]).toEqual(plan); expect(args[3]).toBe('test-token');
    await act(async () => pending.resolve({ split: { training_plan: args[1] } })); expect(workoutsAPI.log).toHaveBeenCalledTimes(1);
});
test('routine update failure keeps the workout and offers saving just today', async () => {
    await changedRoutine(); (workoutsAPI.updateRoutine as jest.Mock).mockRejectedValueOnce(new Error('Routine changed on another device'));
    await pressAction('Update routine & save workout'); expect(workoutsAPI.log).not.toHaveBeenCalled();
    expect(texts()).toContain('Routine changed on another device'); expect(cards()[0].props.exercise.sets[0].completed).toBe(true);
    await pressAction('Save today only'); expect(workoutsAPI.log).toHaveBeenCalledTimes(1);
});
test('returning to the workout from the routine prompt writes nothing', async () => {
    await changedRoutine(); await pressAction('Back to workout');
    expect(workoutsAPI.log).not.toHaveBeenCalled(); expect(workoutsAPI.updateRoutine).not.toHaveBeenCalled();
    expect(cards()[0].props.exercise.sets[0].completed).toBe(true);
});

test('a workout-save failure after a routine update retries the workout without updating the routine twice', async () => {
    await changedRoutine();
    (workoutsAPI.updateRoutine as jest.Mock).mockImplementationOnce(async (_id, training_plan) => ({ split: { training_plan } }));
    (workoutsAPI.log as jest.Mock).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ prs: [] });
    await pressAction('Update routine & save workout');
    expect(mockToast.error).toHaveBeenCalledWith('Routine updated; workout not saved', 'Offline');
    expect(cards()[0].props.exercise.sets[0].completed).toBe(true);
    await pressAction('Finish workout');
    expect(workoutsAPI.updateRoutine).toHaveBeenCalledTimes(1); expect(workoutsAPI.log).toHaveBeenCalledTimes(2);
});

test('an explicit empty start skips suggested plans but preserves a real active draft', async () => {
    delete mockParams.intent; mockParams.start = 'empty';
    await mount(); expect(cards()).toHaveLength(0); expect(workoutsAPI.getMySplits).not.toHaveBeenCalled();
    await act(async () => screen.unmount()); screen = null;
    await saveActiveWorkoutDraft('a', { version: 1, intent: { session_label: 'My Session' }, startedAt: new Date().toISOString(), visibility: 'private', restDuration: 90,
        exercises: [{ id: 'saved', name: 'Saved Row', sets: [{ id: 's', weight_kg: 40, reps: 8, completed: true }] }] });
    await mount(); expect(cards()[0].props.exercise.name).toBe('Saved Row');
});
test('adds a library exercise exactly once after account draft restoration', async () => {
    delete mockParams.intent; mockParams.start = 'empty'; mockParams.addExerciseId = 'press';
    await mount();
    expect(exerciseAPI.getById).toHaveBeenCalledTimes(1);
    expect(cards()).toHaveLength(1); expect(cards()[0].props.exercise.name).toBe('Chest Press');
    expect(cards()[0].props.exercise.sets[0].completed).toBe(false);
    await act(async () => screen.update(<WorkoutLogScreen />)); expect(cards()).toHaveLength(1);
});
test('a free workout stays unrestricted and asks for its focus before saving', async () => {
    delete mockParams.intent; mockParams.start = 'empty'; mockParams.addExerciseId = 'press';
    await mount();
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === 'Add exercise');
    await act(async () => add.props.onPress());
    const picker = screen.root.findByType(ExerciseList);
    expect(picker.props.allowedBodyParts).toBeUndefined();
    const modal = screen.root.findAll((node: any) => node.props.visible === true && typeof node.props.onRequestClose === 'function')[0];
    await act(async () => modal.props.onRequestClose());
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 40));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'reps', 8));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
    const finish = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => String(item.props.children).toLowerCase().includes('finish')));
    await act(async () => finish.props.onPress());
    expect(workoutsAPI.log).not.toHaveBeenCalled();
    expect(screen.root.findByType(WorkoutCategorySheet).props.visible).toBe(true);
    (workoutsAPI.log as jest.Mock).mockResolvedValueOnce({ prs: [] });
    await act(async () => screen.root.findByType(WorkoutCategorySheet).props.onChoose('legs'));
    expect(cards()[0].props.exercise.sets[0]).toMatchObject({ weight_kg: 40, reps: 8, completed: true });
    expect(workoutsAPI.log).toHaveBeenCalledTimes(1);
    expect(workoutsAPI.log).toHaveBeenCalledWith(expect.objectContaining({ workout_type: 'legs', day_name: 'Legs workout' }));
});
test('starts an Upper session with all muscles available and adds several exercises before Done', async () => {
    mockParams.intent = JSON.stringify({ session_label: 'Upper 1' });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValueOnce({ splits: [] });
    await mount();
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === 'Add exercise');
    await act(async () => add.props.onPress());
    const picker = () => screen.root.findByType(ExerciseList);
    expect(picker().props.initialFilter).toBeUndefined();
    expect(picker().props.allowedBodyParts).toBeUndefined();
    await act(async () => { picker().props.onSelect({ id: 'row', name: 'Cable Row' }); picker().props.onSelect({ id: 'row', name: 'Cable Row' }); });
    await act(async () => picker().props.onSelect({ id: 'press', name: 'Chest Press' }));
    expect(cards()).toHaveLength(2);
    expect(picker().props.selectedExercises).toHaveLength(2);
    expect(texts()).toContain('Done · 2 exercises');
    expect(texts()).not.toContain('Show all muscles');
});
test('choosing a free-workout focus twice while saving cannot log the completed sets twice', async () => {
    delete mockParams.intent; mockParams.start = 'empty'; mockParams.addExerciseId = 'press';
    await mount();
    await act(async () => { cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 40); cards()[0].props.onUpdateSet(0, 0, 'reps', 8); cards()[0].props.onUpdateSet(0, 0, 'completed', true); });
    const pending = deferred(); (workoutsAPI.log as jest.Mock).mockReturnValue(pending.promise);
    const finish = screen.root.findAllByProps({ accessibilityLabel: 'Finish workout' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => finish.props.onPress());
    await act(async () => { const choose = screen.root.findByType(WorkoutCategorySheet).props.onChoose; choose('chest'); choose('chest'); });
    expect(workoutsAPI.log).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ prs: [] }));
});

test('opens the exercise editor from session setup after restoring a workout', async () => {
    mockParams.editExercises = '1';
    await mount();
    expect(screen.root.findByType(WorkoutExercisesSheet).props.visible).toBe(true);
    expect(cards()).toHaveLength(3);
});

test('reordering keeps entered sets and replacing asks before clearing only that exercise', async () => {
    await mount();
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 60));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
    const original = cards()[0].props.exercise;
    const neighbour = cards()[1].props.exercise;
    await act(async () => screen.root.findByType(WorkoutExercisesSheet).props.onMove(0, 1));
    expect(cards()[1].props.exercise).toEqual(original);
    expect(cards()[0].props.exercise).toEqual(neighbour);
    await act(async () => screen.root.findByType(WorkoutExercisesSheet).props.onReplace(1));
    await act(async () => screen.root.findByType(ExerciseList).props.onSelect({ id: 'new', name: 'Replacement Row' }));
    expect(cards()[1].props.exercise).toEqual(original);
    expect(screen.root.findByType(ConfirmationSheet).props.action.title).toBe('Replace exercise?');
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(cards()[1].props.exercise.name).toBe('Replacement Row');
    expect(cards()[1].props.exercise.sets.every((set: any) => set.weight_kg === '' && !set.completed)).toBe(true);
    expect(cards()[0].props.exercise).toEqual(neighbour);
    expect(workoutsAPI.log).not.toHaveBeenCalled();
});

test('opens weight and rep fields in the remembered mode and keeps typed values when switching to the wheel', async () => {
    await AsyncStorage.setItem(workoutInputModeKey('a'), 'typing');
    await mount();
    await act(async () => cards()[0].props.onOpenPicker(0, 0, 'weight'));
    const weight = () => screen.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'Weight value');
    expect(weight().props.value).toBe('');
    await act(async () => weight().props.onChangeText('62.5'));
    const wheel = screen.root.findAllByProps({ accessibilityLabel: 'Use scroll wheel' }).find((n: any) => typeof n.props.onPress === 'function');
    await act(async () => wheel.props.onPress());
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    const picker = screen.root.findAll((n: any) => n.props.selectedValue === 62.5)[0];
    expect(picker).toBeTruthy();
    expect(await AsyncStorage.getItem(workoutInputModeKey('a'))).toBe('wheel');
    await act(async () => screen.root.findByType(WorkoutSetEditor).props.onClose());
    await act(async () => cards()[0].props.onOpenPicker(0, 0, 'reps'));
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
});

test('saving both fields completes only that set and keeps copied additional sets unchecked', async () => {
    await mount();
    await act(async () => cards()[0].props.onOpenPicker(0, 0, 'weight'));
    await act(async () => screen.root.findByType(WorkoutSetEditor).props.onSave({ weight_kg: 0, reps: 12 }, true));
    expect(screen.root.findAllByType(WorkoutSetEditor)).toHaveLength(0);
    expect(cards()[0].props.exercise.sets[0]).toMatchObject({ weight_kg: 0, reps: 12, completed: true });
    expect(cards()[0].props.exercise.sets[1].completed).toBe(false);
    await act(async () => cards()[0].props.onOpenPicker(0, 1, 'reps'));
    expect(screen.root.findByType(WorkoutSetEditor).props.previousSet).toMatchObject({ weight_kg: 0, reps: 12 });
    await act(async () => screen.root.findByType(WorkoutSetEditor).props.onSave({ weight_kg: 0, reps: 10 }, false));
    expect(cards()[0].props.exercise.sets[1]).toMatchObject({ weight_kg: 0, reps: 10, completed: false });
    await act(async () => cards()[0].props.onAddSet(0));
    expect(cards()[0].props.exercise.sets.at(-1)).toMatchObject({ weight_kg: 0, reps: 10, completed: false });
});
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
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === 'Add exercise');
    await act(async () => add.props.onPress());
    await act(async () => screen.root.findByType(ExerciseList).props.onSelect(exercise));
    await act(async () => cards()[0].props.onRemoveExercise(0));
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
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

test('opens a custom saved workout with all seven exercises and its prescription', async () => {
    mockParams.intent = JSON.stringify({ session_label: 'Upper 1', training_pattern: 'custom' });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ is_active: true, split_id: 'custom', days: customWorkoutPlan.schedule, training_plan: customWorkoutPlan }] });
    await mount();
    expect(cards().map((node: any) => node.props.exercise.name)).toEqual(customWorkoutPlan.sessions[0].exercises.map(ex => ex.name));
    expect(cards()[0].props.exercise.instructions).toContain('7–10 reps');
    expect(texts()).toContain('Saved routine · edit as you train.');
});

test('opening Log Workout without an intent resolves the active saved day before looking up history', async () => {
    delete mockParams.intent;
    await mount();
    expect(workoutsAPI.getMySplits).toHaveBeenCalled();
    expect(workoutsAPI.getLatest).toHaveBeenCalledWith('chest', 'Full Body A');
    expect(cards()).toHaveLength(3);
    expect(texts()).toContain('Full Body A');
});

test('saved days can be selected inside the logger without carrying sets into the other day', async () => {
    mockParams.intent = JSON.stringify({ session_label: 'Upper 1', training_pattern: 'custom' });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ is_active: true, split_id: 'custom', days: customWorkoutPlan.schedule, training_plan: customWorkoutPlan }] });
    await mount();
    const lower = screen.root.findAllByProps({ accessibilityLabel: 'Load Lower 1 workout' }).find((node: any) => typeof node.props.onPress === 'function');
    expect(lower).toBeTruthy();
    await act(async () => lower.props.onPress());
    expect(cards().map((node: any) => node.props.exercise.name)).toEqual(customWorkoutPlan.sessions[1].exercises.map(ex => ex.name));
    expect(workoutsAPI.getLatest).toHaveBeenLastCalledWith('legs', 'Lower 1');
});

test('switching saved days asks before replacing entered sets', async () => {
    mockParams.intent = JSON.stringify({ session_label: 'Upper 1', training_pattern: 'custom' });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ is_active: true, split_id: 'custom', days: customWorkoutPlan.schedule, training_plan: customWorkoutPlan }] });
    await mount();
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 60));
    const lower = screen.root.findAllByProps({ accessibilityLabel: 'Load Lower 1 workout' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => lower.props.onPress());
    expect(screen.root.findByType(ConfirmationSheet).props.action.title).toBe('Switch workout?');
    expect(cards()[0].props.exercise.name).toBe('Chest press');
    expect(cards()[0].props.exercise.sets[0].weight_kg).toBe(60);
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(cards()[0].props.exercise.name).toBe('Hamstring curls');
});

test('schedule-only splits explain why there are no saved exercise rows', async () => {
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ ...saved.splits[0], training_plan: null }] });
    await mount();
    expect(cards()).toHaveLength(0);
    expect(texts()).toContain('This split saves your training days only');
});

test('a delayed generic setup cannot clear an exercise the user has already added', async () => {
    delete mockParams.intent;
    const delayed = deferred();
    (workoutsAPI.getMySplits as jest.Mock).mockReturnValueOnce(delayed.promise);
    await mount();
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === 'Add exercise');
    await act(async () => add.props.onPress());
    await act(async () => screen.root.findByType(ExerciseList).props.onSelect({ id: 'own', name: 'My Exercise' }));
    await act(async () => delayed.resolve(saved));
    expect(cards().map((node: any) => node.props.exercise.name)).toEqual(['My Exercise']);
});

test('a new routed workout day clears the old day and loads the matching template', async () => {
    mockParams.intent = JSON.stringify({ session_label: 'Upper 1', training_pattern: 'custom' });
    (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ is_active: true, split_id: 'custom', days: customWorkoutPlan.schedule, training_plan: customWorkoutPlan }] });
    await mount();
    mockParams.intent = JSON.stringify({ session_label: 'Lower 1', training_pattern: 'custom' });
    await act(async () => screen.update(<WorkoutLogScreen />));
    expect(cards()[0].props.exercise.name).toBe('Hamstring curls');
});

test('restores all five logged exercises after the screen is destroyed and reopened without an intent', async () => {
    mockParams.curatedExercises = JSON.stringify(Array.from({ length: 5 }, (_, i) => ({
        id: `exercise-${i}`, name: `Logged exercise ${i + 1}`, is_unilateral: i === 2,
        instructions: 'Keep a controlled tempo',
        sets: [{ id: `set-${i}`, reps: 8 + i, weight_kg: 20 + i, rir: 2, completed: true }],
    })));
    await mount();
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 62.5));
    const entered = cards().map((node: any) => node.props.exercise);
    await act(async () => screen.unmount()); screen = null;
    delete mockParams.curatedExercises; delete mockParams.intent;
    await mount();
    expect(cards().map((node: any) => node.props.exercise)).toEqual(entered);
    expect(texts()).toContain('Full Body A');
});

test('retains the draft when saving fails and clears it only after the workout is saved', async () => {
    await mount();
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 60));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
    const finish = () => screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => String(item.props.children).toLowerCase().includes('finish')));
    (workoutsAPI.log as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => finish().props.onPress());
    expect(syncWorkoutActivity).not.toHaveBeenCalled();
    await act(async () => screen.unmount()); screen = null;
    await mount();
    expect(cards()[0].props.exercise.sets[0]).toMatchObject({ weight_kg: 60, completed: true });
    (workoutsAPI.log as jest.Mock).mockResolvedValueOnce({ prs: [] });
    await act(async () => finish().props.onPress());
    expect(syncWorkoutActivity).toHaveBeenCalledWith('', null);
    await act(async () => screen.unmount()); screen = null;
    await mount();
    expect(cards().every((node: any) => node.props.exercise.sets.every((set: any) => !set.completed))).toBe(true);
});

test('restores the original start time and sharing choice when finishing a recovered session', async () => {
    await saveActiveWorkoutDraft('a', {
        version: 1, intent: { session_label: 'Pull', training_pattern: 'ppl' },
        startedAt: new Date(Date.now() - 35 * 60000).toISOString(), visibility: 'friends', restDuration: 120,
        exercises: [{ id: 'row', name: 'Row', sets: [{ id: 's', reps: 12, weight_kg: 22.5, completed: true }] }],
    });
    await mount();
    (workoutsAPI.log as jest.Mock).mockResolvedValueOnce({ prs: [] });
    const finish = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => String(item.props.children).toLowerCase().includes('finish')));
    await act(async () => finish.props.onPress());
    expect(workoutsAPI.log).toHaveBeenCalledWith(expect.objectContaining({ day_name: 'Pull', duration_minutes: 35, visibility: 'friends' }));
});

test('backgrounding for ten minutes and restarting preserves the completed sets', async () => {
    jest.useFakeTimers();
    const listener = AppState.addEventListener as jest.Mock;
    try {
        await mount();
        await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 42.5));
        await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
        const entered = cards().map((node: any) => node.props.exercise);
        const background = listener.mock.calls.find(([event]) => event === 'change')![1];
        await act(async () => background('background'));
        await act(async () => jest.advanceTimersByTime(10 * 60 * 1000));
        await act(async () => screen.unmount()); screen = null;
        await mount();
        expect(cards().map((node: any) => node.props.exercise)).toEqual(entered);
    } finally {
        jest.useRealTimers();
    }
});

test('a storage read failure cannot overwrite a saved workout and retry restores it', async () => {
    await saveActiveWorkoutDraft('a', {
        version: 1, intent: { session_label: 'Pull' }, startedAt: new Date().toISOString(), visibility: 'private', restDuration: 90,
        exercises: [{ id: 'own', name: 'Previously logged row', sets: [{ id: 's', reps: 10, weight_kg: 30, completed: true }] }],
    });
    const originalGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    let readFails = true;
    const read = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(key => {
        if (key === activeWorkoutDraftKey('a') && readFails) return Promise.reject(new Error('storage unavailable'));
        return originalGetItem(key);
    });
    try {
        await mount();
        expect(texts()).toContain('Could not restore your workout');
        expect(workoutsAPI.getMySplits).not.toHaveBeenCalled();
        expect(cards()).toHaveLength(0);
        readFails = false;
        const retry = screen.root.findAllByProps({ accessibilityLabel: 'Retry restoring workout' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => retry.props.onPress());
        expect(cards()[0].props.exercise).toMatchObject({ name: 'Previously logged row', sets: [expect.objectContaining({ completed: true, weight_kg: 30 })] });
    } finally { read.mockImplementation(originalGetItem); }
});

test('successful completion ends the system activity even if removing the local backup fails', async () => {
    await mount();
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'weight_kg', 40));
    await act(async () => cards()[0].props.onUpdateSet(0, 0, 'completed', true));
    (workoutsAPI.log as jest.Mock).mockResolvedValueOnce({ prs: [] });
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('storage busy'));
    const finish = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => String(item.props.children).toLowerCase().includes('finish')));
    await act(async () => finish.props.onPress());
    expect(syncWorkoutActivity).toHaveBeenCalledWith('', null);
    expect(mockToast.error).toHaveBeenCalledWith('Workout saved', expect.any(String));
});

test('discarding requires confirmation, then removes the backup and ends the activity', async () => {
    await mount();
        const discard = screen.root.findAllByProps({ accessibilityLabel: 'Discard workout' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => discard.props.onPress());
        expect(screen.root.findByType(ConfirmationSheet).props.action.title).toBe('Discard workout?');
        expect(await AsyncStorage.getItem(activeWorkoutDraftKey('a'))).not.toBeNull();
        expect(syncWorkoutActivity).not.toHaveBeenCalled();
        await act(async () => screen.root.findByType(ConfirmationSheet).props.onCancel());
        expect(await AsyncStorage.getItem(activeWorkoutDraftKey('a'))).not.toBeNull();
        await act(async () => discard.props.onPress());
        await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
        expect(await AsyncStorage.getItem(activeWorkoutDraftKey('a'))).toBeNull();
        expect(syncWorkoutActivity).toHaveBeenCalledWith('', null);
        expect(router.back).toHaveBeenCalled();
});

test('failed discard preserves progress and keeps the activity running', async () => {
    await mount();
        const discard = screen.root.findAllByProps({ accessibilityLabel: 'Discard workout' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => discard.props.onPress());
        (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
        await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
        expect(await AsyncStorage.getItem(activeWorkoutDraftKey('a'))).not.toBeNull();
        expect(syncWorkoutActivity).not.toHaveBeenCalled();
        expect(mockToast.error).toHaveBeenCalledWith('Could not discard workout', expect.any(String));
        await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
        expect(await AsyncStorage.getItem(activeWorkoutDraftKey('a'))).toBeNull();
});

test('discard returns a directly opened workout to the Workout tab', async () => {
    (router.canGoBack as jest.Mock).mockReturnValueOnce(false);
    await mount();
    const discard = screen.root.findAllByProps({ accessibilityLabel: 'Discard workout' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => discard.props.onPress());
    await act(async () => screen.root.findByType(ConfirmationSheet).props.action.onConfirm());
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});
