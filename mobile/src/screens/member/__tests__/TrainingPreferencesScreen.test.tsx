import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import TrainingPreferencesScreen from '../TrainingPreferencesScreen';
import { workoutsAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
const mockWeekly = jest.fn();
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ updateWeeklyGoal: mockWeekly }) }));
jest.mock('../../../services/api', () => ({ getAuthToken: async () => 'session-a', workoutsAPI: { getTrainingPreferences: jest.fn(), saveTrainingPreferences: jest.fn(), removeTrainingPreferences: jest.fn() } }));
const split = { id: '00000000-0000-4000-8000-000000000001', split_id: 'adopted_custom', name: 'My custom routine', days: ['Push'], days_per_week: 1 };
const preferences = { experience: 'new', equipment: 'gym', session_minutes: 35, goal_type: 'maintenance' };
let screen: any;
const press = async (label: string) => {
    const button = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label || node.findAllByType(Text).some((t: any) => t.props.children === label));
    await act(async () => { await button.props.onPress(); });
};
const text = () => screen.root.findAllByType(Text).map((t: any) => t.props.children).flat().join(' ');
beforeEach(() => {
    jest.clearAllMocks();
    (workoutsAPI.getTrainingPreferences as jest.Mock).mockResolvedValue({ preferences, split, age: 25 });
    (workoutsAPI.saveTrainingPreferences as jest.Mock).mockResolvedValue({});
    (workoutsAPI.removeTrainingPreferences as jest.Mock).mockResolvedValue({});
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; });
const mount = async () => { await act(async () => { screen = create(<TrainingPreferencesScreen />); }); };
it('reviews preferences without replacing a custom routine by default', async () => {
    await mount(); await press('Review changes');
    expect(text()).toContain('My custom routine');
    expect(workoutsAPI.saveTrainingPreferences).not.toHaveBeenCalled();
    await press('Save changes');
    expect(workoutsAPI.saveTrainingPreferences).toHaveBeenCalledWith({ preferences, expected_split_id: split.id }, 'session-a');
    expect(mockWeekly).not.toHaveBeenCalled();
});
it('previews equipment-specific exercises and applies a routine only after confirmation', async () => {
    await mount(); await press('Choose training equipment'); await press('No equipment'); await press('Preview a replacement routine'); await press('Review changes');
    expect(text()).toContain('Bodyweight Squat'); expect(text()).not.toContain('Leg Press');
    expect(workoutsAPI.saveTrainingPreferences).not.toHaveBeenCalled();
    await press('Save changes');
    const saved = (workoutsAPI.saveTrainingPreferences as jest.Mock).mock.calls[0][0];
    expect(saved.replacement.training_plan.preferences.equipment).toBe('bodyweight');
    expect(saved.replacement.training_plan.sessions[0].exercises.every((e: any) => !('weight_kg' in e) && !('completed' in e))).toBe(true);
    expect(mockWeekly).toHaveBeenCalledWith(1);
});
it('keeps failed-save choices visible and allows a retry', async () => {
    (workoutsAPI.saveTrainingPreferences as jest.Mock).mockRejectedValueOnce(new Error('Your routine changed. Reload it.'));
    await mount(); await press('Review changes'); await press('Save changes');
    expect(text()).toContain('Your routine changed. Reload it.');
    await press('Save changes'); expect(workoutsAPI.saveTrainingPreferences).toHaveBeenCalledTimes(2);
});
it('removal needs an explicit second action and describes what remains', async () => {
    await mount(); await press('Remove saved training preferences');
    expect(workoutsAPI.removeTrainingPreferences).not.toHaveBeenCalled();
    expect(text()).toContain('performed workout logs are kept');
    await press('Remove preferences and suggestions');
    expect(workoutsAPI.removeTrainingPreferences).toHaveBeenCalledWith('session-a');
});
it('shows a failed initial load with reload and prevents editing unknown server data', async () => {
    (workoutsAPI.getTrainingPreferences as jest.Mock).mockRejectedValueOnce(new Error('Unavailable'));
    await mount(); expect(text()).toContain('Unavailable'); expect(text()).not.toContain('Review changes');
    await press('Reload preferences'); expect(text()).toContain('My custom routine');
});
it('preserves a legacy seven-day custom routine and asks for supported days before a replacement', async () => {
    (workoutsAPI.getTrainingPreferences as jest.Mock).mockResolvedValue({ preferences, split: { ...split, days_per_week: 7 }, age: null });
    await mount(); await press('Review changes'); await press('Save changes');
    expect(workoutsAPI.saveTrainingPreferences).toHaveBeenCalledWith({ preferences, expected_split_id: split.id }, 'session-a');
    await press('Preview a replacement routine'); await press('Review changes');
    expect(text()).toContain('Choose training days to replace your routine');
});
