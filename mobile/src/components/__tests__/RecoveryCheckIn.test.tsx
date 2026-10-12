import React from 'react';
import { Text, TextInput } from 'react-native';
import RecoveryCheckIn from '../RecoveryCheckIn';
import { readinessAPI } from '../../services/api';
import { localDateString } from '../../utils/healthDate';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({ useFocusEffect: (callback: any) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../../services/api', () => ({ readinessAPI: { getToday: jest.fn(), checkin: jest.fn() } }));
let screen: any;
const labels = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const saveButton = () => screen.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAllByType(Text).some((text: any) => text.props.children === 'Save check-in'))[0];
beforeEach(() => {
    jest.clearAllMocks();
    (readinessAPI.getToday as jest.Mock).mockResolvedValue({ checked_in: false, readiness: null });
    (readinessAPI.checkin as jest.Mock).mockResolvedValue({ success: true, readiness: { energy_level: 3, sleep_quality: 4, soreness: 2, sleep_hours: null } });
});
afterEach(async () => { await act(async () => screen?.unmount()); });
async function open() {
    await act(async () => { screen = create(<RecoveryCheckIn userId="a" />); });
    await act(async () => button('Open recovery check-in').props.onPress());
}
async function fill() {
    for (const label of ['Energy 3 of 5', 'Sleep quality 4 of 5', 'Muscle soreness 2 of 5']) {
        await act(async () => button(label).props.onPress());
    }
}
it('keeps the check-in optional and requires chosen answers without silent defaults', async () => {
    await open();
    expect(labels()).toContain('Optional recovery check-in');
    expect(labels()).toContain('do not measure your health');
    expect(saveButton().props.disabled).toBe(true);
    expect(readinessAPI.checkin).not.toHaveBeenCalled();
    await fill();
    expect(saveButton().props.disabled).toBe(false);
    await act(async () => saveButton().props.onPress());
    expect(readinessAPI.checkin).toHaveBeenCalledWith({ energy_level: 3, sleep_quality: 4, soreness: 2, sleep_hours: undefined, date: localDateString() });
    expect(labels()).toContain('Check-in saved for today');
    expect(labels()).not.toContain('Score');
});
it('preserves answers when a save fails and lets the user retry', async () => {
    (readinessAPI.checkin as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await open(); await fill();
    await act(async () => saveButton().props.onPress());
    expect(labels()).toContain('Your answers are kept');
    expect(button('Energy 3 of 5').props.accessibilityState.checked).toBe(true);
    await act(async () => saveButton().props.onPress());
    expect(readinessAPI.checkin).toHaveBeenCalledTimes(2);
    expect(labels()).toContain('Check-in saved for today');
});
it('validates optional hours and preserves a reported zero', async () => {
    await open(); await fill();
    await act(async () => screen.root.findByType(TextInput).props.onChangeText('-1'));
    await act(async () => saveButton().props.onPress());
    expect(readinessAPI.checkin).not.toHaveBeenCalled();
    expect(labels()).toContain('between 0 and 24');
    await act(async () => screen.root.findByType(TextInput).props.onChangeText('0'));
    await act(async () => saveButton().props.onPress());
    expect(readinessAPI.checkin).toHaveBeenCalledWith(expect.objectContaining({ sleep_hours: 0 }));
});
it('shows failed loading as an error rather than an absent check-in', async () => {
    (readinessAPI.getToday as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await open();
    expect(labels()).toContain('Could not load');
    expect(labels()).toContain('You can still log a workout');
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    expect(readinessAPI.checkin).not.toHaveBeenCalled();
});
it('keeps existing notes and answers when editing a check-in', async () => {
    (readinessAPI.getToday as jest.Mock).mockResolvedValue({ checked_in: true, readiness: { energy_level: 2, sleep_quality: 4, soreness: 2, sleep_hours: 7.5, notes: 'Existing note' } });
    await act(async () => { screen = create(<RecoveryCheckIn userId="a" />); });
    await act(async () => button('Edit recovery check-in').props.onPress());
    expect(button('Energy 2 of 5').props.accessibilityState.checked).toBe(true);
    await act(async () => saveButton().props.onPress());
    expect(readinessAPI.checkin).toHaveBeenCalledWith(expect.objectContaining({ sleep_hours: 7.5, energy_level: 2 }));
    expect((readinessAPI.checkin as jest.Mock).mock.calls[0][0]).not.toHaveProperty('notes');
});
