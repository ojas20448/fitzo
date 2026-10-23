import React from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import WorkoutIntentScreen from '../WorkoutIntentScreen';
import { workoutsAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../components/ScreenBackdrop', () => () => null);
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../../services/api', () => ({
    workoutsAPI: { getMySplits: jest.fn(async () => ({ splits: [] })), saveSplit: jest.fn() },
    intentAPI: { getSuggestion: jest.fn(async () => ({ suggestion: null })), setIntent: jest.fn() },
}));
let screen: any;
const text = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => { await act(async () => { await control(label).props.onPress(); }); };
const field = (label: string) => screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label);
const input = async (label: string, value: string) => { await act(async () => field(label).props.onChangeText(value)); };
async function builder() {
    await act(async () => { screen = create(<WorkoutIntentScreen />); });
    if (!control('Create custom split')) throw new Error(`Missing builder button: ${text()}`);
    await press('Create custom split');
    await press('Add Push day');
}
beforeEach(() => { jest.clearAllMocks(); (workoutsAPI.saveSplit as jest.Mock).mockResolvedValue({ split: { id: 'saved' } }); });
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });

test('keeps a custom split in the builder after a save failure and retries the same draft', async () => {
    (workoutsAPI.saveSplit as jest.Mock).mockRejectedValueOnce(new Error('Could not connect. Try again.'));
    await builder(); await input('Custom split name', '  My training  '); await press('Add Pull day'); await press('Use this split');
    expect(text()).toContain('Could not connect. Try again.');
    expect(field('Custom split name').props.value).toBe('  My training  ');
    expect(control('Remove Push from day 1')).toBeTruthy();
    expect(control('Remove Pull from day 2')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await press('Use this split');
    expect(workoutsAPI.saveSplit).toHaveBeenLastCalledWith({ split_id: 'custom', name: 'My training', days: ['Push', 'Pull'], days_per_week: 2 });
    expect(field('Custom split name')).toBeUndefined();
    expect(text()).toContain('My training');
});

test('blocks repeated submission and changes to a pending custom split', async () => {
    let resolve!: (value: object) => void;
    (workoutsAPI.saveSplit as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    await builder();
    await act(async () => { control('Use this split').props.onPress(); control('Use this split').props.onPress(); });
    expect(workoutsAPI.saveSplit).toHaveBeenCalledTimes(1);
    expect(field('Custom split name').props.editable).toBe(false);
    await press('Remove Push from day 1'); await press('Go back'); await press('Skip session setup');
    expect(control('Remove Push from day 1')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    await act(async () => resolve({ split: { id: 'saved' } }));
    expect(field('Custom split name')).toBeUndefined();
});

test('validates the split name and requires a typed day to be added before saving', async () => {
    await builder(); await input('Custom split name', '  '); await press('Use this split');
    expect(text()).toContain('Give your split a name between 1 and 100 characters.');
    expect(workoutsAPI.saveSplit).not.toHaveBeenCalled();
    await input('Custom split name', 'My week'); await press('Write a custom day'); await input('Custom day name', 'Mobility');
    await press('Use this split');
    expect(text()).toContain('Tap the checkmark to add your custom day before saving.');
    expect(workoutsAPI.saveSplit).not.toHaveBeenCalled();
    await press('Add custom day'); await press('Use this split');
    expect(workoutsAPI.saveSplit).toHaveBeenCalledWith(expect.objectContaining({ days: ['Push', 'Mobility'] }));
});
