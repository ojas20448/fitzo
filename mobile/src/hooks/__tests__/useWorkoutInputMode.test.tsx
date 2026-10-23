import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkoutInputMode, workoutInputModeKey } from '../useWorkoutInputMode';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let value: ReturnType<typeof useWorkoutInputMode>;
let screen: any;
const Probe = ({ id }: { id: string }) => { value = useWorkoutInputMode(id); return null; };
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
afterEach(async () => { await act(async () => screen?.unmount()); });
const mount = async (id = 'a') => { await act(async () => { screen = create(<Probe id={id} />); }); };
it('remembers the chosen mode across visits and keeps it separate for each account', async () => {
    await mount(); expect(value.inputMode).toBe('typing');
    await act(async () => { value.selectMode('typing'); });
    expect(await AsyncStorage.getItem(workoutInputModeKey('a'))).toBe('typing');
    await act(async () => screen.unmount()); await mount(); expect(value.inputMode).toBe('typing');
    await act(async () => screen.update(<Probe id="b" />)); expect(value.inputMode).toBe('typing');
    await act(async () => screen.update(<Probe id="a" />)); expect(value.inputMode).toBe('typing');
});
it('preserves an existing preference for the wheel', async () => {
    await AsyncStorage.setItem(workoutInputModeKey('a'), 'wheel');
    await mount(); expect(value.inputMode).toBe('wheel');
});
it('a delayed storage read cannot overwrite a mode the user just selected', async () => {
    let resolve!: (mode: string) => void;
    (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await mount(); await act(async () => { value.selectMode('typing'); });
    await act(async () => { resolve('wheel'); }); expect(value.inputMode).toBe('typing');
});
it('queues writes in the order of rapid toggles and tolerates a storage failure', async () => {
    await mount(); let resolve!: () => void;
    (AsyncStorage.setItem as jest.Mock).mockReturnValueOnce(new Promise<void>(r => { resolve = r; }));
    await act(async () => { value.selectMode('typing'); value.selectMode('wheel'); });
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(workoutInputModeKey('a'), 'wheel');
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk unavailable'));
    await act(async () => { value.selectMode('typing'); }); expect(value.inputMode).toBe('typing');
});
