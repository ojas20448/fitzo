import React from 'react';
import { Text } from 'react-native';
import MealBuilderSheet, { Preset } from '../MealBuilderSheet';
import { nutritionAPI, getAuthToken } from '../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../../services/api', () => ({ nutritionAPI: { logBulk: jest.fn() }, getAuthToken: jest.fn() }));
jest.mock('../../utils/haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));

const rice = { meal_name: 'Rice', calories: 206, protein: 4.3, carbs: 45, fat: 0.4, portion: { amount: 1, unit: 'cup', grams: 150, preparation: 'cooked' } };
const preset: Preset = { id: 'lunch', name: 'Dal plate', emoji: '🍛', meal_type: 'lunch', description: 'A familiar plate.', items: [
    { meal_name: 'Dal', calories: 198, protein: 11, carbs: 34, fat: 1, portion: { amount: 1, unit: 'cup', grams: 200, preparation: 'cooked' }, alternatives: [rice] },
] };
let screen: any;
let onClose: jest.Mock;
let onLogged: jest.Mock;
let onError: jest.Mock;
const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const labels = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const logButton = () => screen.root.findAll((node: any) => typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel).startsWith('Log meal,'))[0];
beforeEach(() => {
    jest.clearAllMocks();
    onClose = jest.fn(); onLogged = jest.fn(); onError = jest.fn();
    (getAuthToken as jest.Mock).mockResolvedValue('account-a');
    (nutritionAPI.logBulk as jest.Mock).mockResolvedValue({ totals: { calories: 198 } });
});
afterEach(async () => { await act(async () => screen?.unmount()); });
const open = async () => { await act(async () => { screen = create(<MealBuilderSheet preset={preset} onClose={onClose} onLogged={onLogged} onError={onError} />); }); };

it('opens for review, then scales and swaps actual portions without writing prematurely', async () => {
    await open();
    expect(labels()).toContain('1 cup · 200 g, cooked');
    expect(nutritionAPI.logBulk).not.toHaveBeenCalled();
    await act(async () => button('Decrease Dal').props.onPress());
    expect(labels()).toContain('0.5 cup · 100 g, cooked');
    await act(async () => button('Swap Dal').props.onPress());
    await act(async () => button('Use Rice').props.onPress());
    expect(labels()).toContain('1 cup · 150 g, cooked');
    expect(labels()).toMatch(/206\s+kcal/);
    await act(async () => logButton().props.onPress());
    expect(nutritionAPI.logBulk).toHaveBeenCalledWith([expect.objectContaining({ meal_name: 'Rice', calories: 206, serving_size: '1 cup · 150 g, cooked' })], 'lunch', 'account-a');
});

it('guards immediate double taps, locks editing while saving, and ignores a late result after unmount', async () => {
    let finish!: (value: unknown) => void;
    (nutritionAPI.logBulk as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await open();
    const log = logButton();
    await act(async () => { void log.props.onPress(); void log.props.onPress(); });
    expect(nutritionAPI.logBulk).toHaveBeenCalledTimes(1);
    expect(button('Decrease Dal').props.disabled).toBe(true);
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Close' }).some((node: any) => node.props.disabled === true)).toBe(true);
    await act(async () => screen.unmount());
    screen = null;
    await act(async () => finish({ totals: { calories: 198 } }));
    expect(onLogged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it('keeps portions, substitution and meal category after failure for an explicit retry', async () => {
    (nutritionAPI.logBulk as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await open();
    await act(async () => button('Decrease Dal').props.onPress());
    await act(async () => button('Log as dinner').props.onPress());
    await act(async () => logButton().props.onPress());
    expect(labels()).toContain('Your portions and swaps are kept');
    expect(labels()).toContain('0.5 cup · 100 g, cooked');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => logButton().props.onPress());
    expect(nutritionAPI.logBulk).toHaveBeenLastCalledWith([expect.objectContaining({ calories: 99, serving_size: '0.5 cup · 100 g, cooked' })], 'dinner', 'account-a');
    expect(onLogged).toHaveBeenCalledTimes(1);
});

it('cannot log a draft without an authenticated account', async () => {
    (getAuthToken as jest.Mock).mockResolvedValue(null);
    await open();
    expect(logButton().props.disabled).toBe(true);
    await act(async () => logButton().props.onPress());
    expect(nutritionAPI.logBulk).not.toHaveBeenCalled();
});
