import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { syncWorkoutActivity, workoutActivitySnapshot } from '../workoutActivity';
import type { ActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';

const native = { sync: jest.fn(async () => true), stop: jest.fn(async () => {}) };
const originalAppState = AppState.currentState;
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('expo-notifications', () => ({
    AndroidImportance: { LOW: 2 }, AndroidNotificationVisibility: { PRIVATE: 0 },
    setNotificationChannelAsync: jest.fn(async () => {}), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
}));
const draft: ActiveWorkoutDraft = {
    version: 1, intent: { session_label: 'Pull' }, startedAt: '2026-10-21T10:00:00Z', visibility: 'private', restDuration: 90,
    exercises: [
        { id: 'a', name: 'Row', sets: [{ id: '1', weight_kg: 30, reps: 10, completed: true }] },
        { id: 'b', name: 'Pulldown', sets: [{ id: '2', completed: false }, { id: '3', completed: false }] },
    ],
};
beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
    AppState.currentState = 'active';
    (requireOptionalNativeModule as jest.Mock).mockReturnValue(native);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, canAskAgain: true });
});
afterEach(() => { AppState.currentState = originalAppState; jest.restoreAllMocks(); });

test('uses the original start time, counts checked sets, and shows the next unfinished exercise', () => {
    expect(workoutActivitySnapshot('a', draft)).toMatchObject({ title: 'Pull', currentExercise: 'Pulldown', completedSets: 1, totalSets: 3, startedAtMs: Date.parse(draft.startedAt) });
    expect(workoutActivitySnapshot('a', { ...draft, exercises: [] })).toBeNull();
});
test('updates iOS activity and ends it when the draft is cleared', async () => {
    await syncWorkoutActivity('a', draft);
    expect(native.sync).toHaveBeenCalledWith(workoutActivitySnapshot('a', draft));
    await syncWorkoutActivity('a', null);
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('Android requests permission in context and posts one native chronometer notification', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await syncWorkoutActivity('permission-test', draft, true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.sync).toHaveBeenCalledTimes(1);
});
test('denied notifications never prevent logging or repeatedly prompt on set edits', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await syncWorkoutActivity('denied-test', draft, true);
    await syncWorkoutActivity('denied-test', draft, true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.sync).not.toHaveBeenCalled();
});
test('does not prompt for restored workouts or in the background', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });
    await syncWorkoutActivity('restore-test', draft);
    AppState.currentState = 'background';
    await syncWorkoutActivity('background-test', draft, true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('finishing while permission is pending cannot revive a workout notification', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });
    let resolve!: (value: any) => void;
    (Notifications.requestPermissionsAsync as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const start = syncWorkoutActivity('race-test', draft, true);
    for (let i = 0; i < 10 && !resolve; i++) await Promise.resolve();
    expect(resolve).toBeDefined();
    const finish = syncWorkoutActivity('race-test', null);
    resolve({ granted: true });
    await Promise.all([start, finish]);
    expect(native.sync).not.toHaveBeenCalled();
    expect(native.stop).toHaveBeenCalledTimes(1);
});
test('older installed app builds without the module continue normally', async () => {
    (requireOptionalNativeModule as jest.Mock).mockReturnValue(null);
    await expect(syncWorkoutActivity('a', draft)).resolves.toBeUndefined();
});
