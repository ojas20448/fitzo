import React from 'react';
import { useExerciseHistory, invalidateExerciseHistory } from '../useExerciseHistory';
import { workoutsAPI } from '../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
let mockOwner = 'a';
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockOwner }, token: `token-${mockOwner}` }) }));
jest.mock('../../services/api', () => ({ workoutsAPI: { getHistory: jest.fn() } }));
const groups = [{ logged_date: '2026-10-21', workouts: [{ id: 'one', exercises: [{ name: 'Row', sets: [{ weight_kg: 40, reps: 8 }] }] }] }];
let screen: any; let value: ReturnType<typeof useExerciseHistory>;
function Probe() { value = useExerciseHistory('Row'); return null; }
beforeEach(() => { jest.clearAllMocks(); invalidateExerciseHistory(); mockOwner = 'a'; (workoutsAPI.getHistory as jest.Mock).mockResolvedValue({ history: groups }); });
afterEach(async () => { await act(async () => screen?.unmount()); });
test('shares one account-bound request between cards and refreshes after a saved workout', async () => {
    await act(async () => { screen = create(<><Probe /><Probe /></>); });
    expect(workoutsAPI.getHistory).toHaveBeenCalledTimes(1); expect(workoutsAPI.getHistory).toHaveBeenCalledWith(90, 'token-a');
    expect(value.sessions[0].sets).toEqual([{ weight_kg: 40, reps: 8 }]);
    invalidateExerciseHistory(); await act(async () => screen.unmount());
    await act(async () => { screen = create(<Probe />); }); expect(workoutsAPI.getHistory).toHaveBeenCalledTimes(2);
});
test('an old account response cannot appear after switching accounts', async () => {
    let resolve!: (data: unknown) => void;
    (workoutsAPI.getHistory as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await act(async () => { screen = create(<Probe />); });
    mockOwner = 'b'; (workoutsAPI.getHistory as jest.Mock).mockResolvedValueOnce({ history: [] });
    await act(async () => screen.update(<Probe />));
    await act(async () => resolve({ history: groups })); expect(value.sessions).toEqual([]);
    expect(workoutsAPI.getHistory).toHaveBeenLastCalledWith(90, 'token-b');
});
test('keeps errors distinct from empty history and supports retry', async () => {
    (workoutsAPI.getHistory as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { screen = create(<Probe />); }); expect(value.error).toBe(true);
    await act(async () => value.retry()); expect(value.error).toBe(false); expect(value.sessions).toHaveLength(1);
});
