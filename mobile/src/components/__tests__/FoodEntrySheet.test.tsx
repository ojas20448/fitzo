import React from 'react';
import { TextInput } from 'react-native';
import FoodEntrySheet from '../FoodEntrySheet';
import { caloriesAPI } from '../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../services/api', () => ({ caloriesAPI: { update: jest.fn(), delete: jest.fn() } }));
const entry = { id: 'meal', food_name: 'Rice', serving_size: '1 bowl', meal_type: 'lunch', calories: 200, protein: 4, carbs: 40, fat: 2, logged_date: '2026-10-22', created_at: '2026-10-22' };
let screen: any;
const close = jest.fn(), changed = jest.fn();
const press = async (label: string) => {
    const node = screen.root.findAllByProps({ accessibilityLabel: label }).find((item: any) => typeof item.props.onPress === 'function');
    await act(async () => { await node.props.onPress(); });
};
beforeEach(() => { jest.clearAllMocks(); (caloriesAPI.update as jest.Mock).mockResolvedValue({}); });
afterEach(async () => { await act(async () => screen?.unmount()); });
async function open() { await act(async () => { screen = create(<FoodEntrySheet entry={entry} onClose={close} onChanged={changed} />); }); await press('Edit food entry'); }
it('updates portion nutrition and meal assignment in a single mutation', async () => {
    await open();
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Portion multiplier' }).props.onChangeText('2'));
    await press('dinner'); await press('Save food entry');
    expect(caloriesAPI.update).toHaveBeenCalledTimes(1);
    expect(caloriesAPI.update).toHaveBeenCalledWith('meal', expect.objectContaining({ calories: 400, protein: 8, carbs: 80, fat: 4, serving_size: '2 × 1 bowl', meal_type: 'dinner' }));
    expect(changed).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
it('keeps failed edits open with their values available for retry', async () => {
    await open(); (caloriesAPI.update as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Calories in kcal' }).props.onChangeText('250'));
    await press('Save food entry');
    expect(close).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    const calories = screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Calories in kcal');
    expect(calories.props.value).toBe('250');
    await press('Save food entry'); expect(changed).toHaveBeenCalledTimes(1);
});
it('rejects an invalid portion without saving stale scaled nutrition', async () => {
    await open(); await act(async () => screen.root.findByProps({ accessibilityLabel: 'Portion multiplier' }).props.onChangeText('0'));
    await press('Save food entry'); expect(caloriesAPI.update).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('Check the portion', expect.any(String));
});
