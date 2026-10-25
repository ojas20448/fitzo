import React from 'react';
import { useExercisePreferences } from '../useExercisePreferences';
import { settingsAPI, getAuthToken } from '../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../../services/api', () => ({ settingsAPI: { getExercisePreferences: jest.fn(), updateExercisePreference: jest.fn() }, getAuthToken: jest.fn(async () => 'token-a') }));
let value: ReturnType<typeof useExercisePreferences>, screen: any;
const preference = { exercise_name: 'cable row', note: 'Seat 4', rest_seconds: 120 };
const Probe = ({ user }: { user: string }) => { value = useExercisePreferences(user); return null; };
beforeEach(() => { jest.clearAllMocks(); (settingsAPI.getExercisePreferences as jest.Mock).mockResolvedValue({ preferences: [preference] }); (settingsAPI.updateExercisePreference as jest.Mock).mockResolvedValue({ preference }); });
afterEach(async () => { await act(async () => screen?.unmount()); });
const mount = async () => act(async () => { screen = create(<Probe user="a" />); });
it('loads account preferences and saves the server result with the current session', async () => {
    await mount(); expect(value.preferences['cable row']).toEqual(preference);
    await act(async () => { await value.save(preference); });
    expect(settingsAPI.updateExercisePreference).toHaveBeenCalledWith(preference, 'token-a');
});
it('discards old-account reads and never exposes another account preferences', async () => {
    await mount(); let resolve!: (data: unknown) => void;
    (settingsAPI.getExercisePreferences as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    let pending!: Promise<void>; await act(async () => { pending = value.reload(); });
    (settingsAPI.getExercisePreferences as jest.Mock).mockResolvedValue({ preferences: [] });
    await act(async () => screen.update(<Probe user="b" />));
    expect(value.preferences).toEqual({});
    await act(async () => { resolve({ preferences: [preference] }); await pending; });
    expect(value.preferences).toEqual({});
});
it('failed saves preserve the last saved value and return the original error', async () => {
    await mount(); const error = new Error('Offline');
    (settingsAPI.updateExercisePreference as jest.Mock).mockRejectedValueOnce(error);
    await expect(value.save({ ...preference, note: 'Unsaved edit' })).rejects.toBe(error);
    expect(value.preferences['cable row'].note).toBe('Seat 4');
});
it('cannot write if its account changes during token lookup', async () => {
    await mount(); let resolve!: (token: string) => void;
    (getAuthToken as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = value.save(preference).catch(error => error);
    await act(async () => screen.update(<Probe user="b" />));
    resolve('token-b'); expect((await pending).message).toContain('session changed');
    expect(settingsAPI.updateExercisePreference).not.toHaveBeenCalled();
});
