import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeWorkoutDraftKey, saveActiveWorkoutDraft, loadActiveWorkoutDraft, clearActiveWorkoutDraft, subscribeActiveWorkoutDraft, ActiveWorkoutDraft } from '../activeWorkoutDraft';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const draft = (): ActiveWorkoutDraft => ({
    version: 1, intent: { session_label: 'Pull', training_pattern: 'ppl' },
    startedAt: '2026-10-17T10:00:00.000Z', visibility: 'private', restDuration: 120,
    exercises: [{ id: 'row', name: 'Row', is_unilateral: true, sets: [{ id: 's', reps: 12, weight_kg: 22.5, rir: 2, completed: true }] }],
});

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test('keeps the entire draft across inactivity without exposing it to another account', async () => {
    const entered = draft();
    await saveActiveWorkoutDraft('a', entered);
    expect(await loadActiveWorkoutDraft('b')).toBeNull();
    expect(await loadActiveWorkoutDraft('a')).toEqual(entered);
});

test('serializes rapid edits and snapshots each value before a later edit mutates it', async () => {
    const entered = draft();
    const first = saveActiveWorkoutDraft('a', entered);
    entered.exercises[0].sets[0].weight_kg = 30;
    const last = saveActiveWorkoutDraft('a', entered);
    await Promise.all([first, last]);
    expect(await loadActiveWorkoutDraft('a')).toEqual(entered);
    expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]).exercises[0].sets[0].weight_kg).toBe(22.5);
});

test('finishing waits for pending saves and cannot resurrect the draft', async () => {
    const pending = saveActiveWorkoutDraft('a', draft());
    const finished = clearActiveWorkoutDraft('a');
    await Promise.all([pending, finished]);
    expect(await loadActiveWorkoutDraft('a')).toBeNull();
});

test('a failed write does not block a later retry', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(saveActiveWorkoutDraft('a', draft())).rejects.toThrow('disk unavailable');
    await saveActiveWorkoutDraft('a', draft());
    expect(await loadActiveWorkoutDraft('a')).toEqual(draft());
});

test('preserves a deliberately empty workout instead of loading a template', async () => {
    await saveActiveWorkoutDraft('a', { ...draft(), exercises: [] });
    expect((await loadActiveWorkoutDraft('a'))?.exercises).toEqual([]);
});

test.each(['{broken', JSON.stringify({ ...draft(), exercises: [{ name: 'bad', sets: null }] }), JSON.stringify({ ...draft(), startedAt: 'invalid' })])('ignores an unreadable draft safely', async (raw) => {
    await AsyncStorage.setItem(activeWorkoutDraftKey('a'), raw);
    expect(await loadActiveWorkoutDraft('a')).toBeNull();
});

test('publishes saved snapshots and completion without letting activity UI fail storage', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeActiveWorkoutDraft(listener);
    const unsubscribeBroken = subscribeActiveWorkoutDraft(() => { throw new Error('activity unavailable'); });
    try {
        await saveActiveWorkoutDraft('a', draft());
        expect(listener).toHaveBeenLastCalledWith('a', draft());
        await clearActiveWorkoutDraft('a');
        expect(listener).toHaveBeenLastCalledWith('a', null);
        expect(await loadActiveWorkoutDraft('a')).toBeNull();
    } finally { unsubscribe(); unsubscribeBroken(); }
});
