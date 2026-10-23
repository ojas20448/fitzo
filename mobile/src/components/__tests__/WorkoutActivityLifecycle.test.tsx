import React from 'react';
import { AppState } from 'react-native';
import WorkoutActivityLifecycle from '../WorkoutActivityLifecycle';
import { loadActiveWorkoutDraft, subscribeActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
import { syncWorkoutActivity } from '../../services/workoutActivity';
const { create, act } = jest.requireActual('react-test-renderer');
let mockUserId: string | undefined = 'a';
let mockListener: (id: string, draft: any) => void;
const mockUnsubscribe = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null, isLoading: false }) }));
jest.mock('../../utils/activeWorkoutDraft', () => ({
    loadActiveWorkoutDraft: jest.fn(),
    subscribeActiveWorkoutDraft: jest.fn((listener) => { mockListener = listener; return mockUnsubscribe; }),
}));
jest.mock('../../services/workoutActivity', () => ({ syncWorkoutActivity: jest.fn(async () => {}) }));
const draft = { exercises: [{ name: 'Row' }] };
let screen: any;
beforeEach(() => { jest.clearAllMocks(); mockUserId = 'a'; (loadActiveWorkoutDraft as jest.Mock).mockResolvedValue(draft); });
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });

test('restores the existing workout and follows saved set updates and completion', async () => {
    await act(async () => { screen = create(<WorkoutActivityLifecycle />); });
    expect(syncWorkoutActivity).toHaveBeenCalledWith('a', draft);
    const edited = { ...draft, updated: true };
    await act(async () => mockListener('a', edited));
    expect(syncWorkoutActivity).toHaveBeenLastCalledWith('a', edited, true);
    await act(async () => mockListener('a', null));
    expect(syncWorkoutActivity).toHaveBeenLastCalledWith('a', null, true);
    expect(subscribeActiveWorkoutDraft).toHaveBeenCalledTimes(1);
});
test('ignores another account and clears the card on sign-out', async () => {
    await act(async () => { screen = create(<WorkoutActivityLifecycle />); });
    jest.mocked(syncWorkoutActivity).mockClear();
    await act(async () => mockListener('b', draft));
    expect(syncWorkoutActivity).not.toHaveBeenCalled();
    mockUserId = undefined;
    await act(async () => screen.update(<WorkoutActivityLifecycle />));
    expect(syncWorkoutActivity).toHaveBeenLastCalledWith('', null);
    expect(mockUnsubscribe).toHaveBeenCalled();
});
test('a delayed startup read cannot overwrite a newer saved set', async () => {
    let resolve!: (value: any) => void;
    (loadActiveWorkoutDraft as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => { screen = create(<WorkoutActivityLifecycle />); });
    const latest = { exercises: [{ name: 'Latest row' }] };
    await act(async () => mockListener('a', latest));
    await act(async () => resolve(draft));
    expect(syncWorkoutActivity).toHaveBeenCalledTimes(1);
    expect(syncWorkoutActivity).toHaveBeenLastCalledWith('a', latest, true);
});
test('reconciles after foregrounding without requesting permission again', async () => {
    await act(async () => { screen = create(<WorkoutActivityLifecycle />); });
    const listener = (AppState.addEventListener as jest.Mock).mock.calls.find(([event]: any) => event === 'change')[1];
    jest.mocked(syncWorkoutActivity).mockClear();
    await act(async () => listener('active'));
    expect(syncWorkoutActivity).toHaveBeenLastCalledWith('a', draft);
});
