import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import FitnessProfileScreen from '../FitnessProfileScreen';
import { nutritionAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
const mockError = jest.fn();
const mockWeekly = jest.fn();
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: mockError, success: jest.fn() }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ weeklyWorkoutGoal: 3, updateWeeklyGoal: mockWeekly, refreshToday: jest.fn() }) }));
jest.mock('../../../services/api', () => ({ getAuthToken: async () => 'session-a', nutritionAPI: { getProfile: jest.fn(), updateProfile: jest.fn() }, workoutsAPI: { getTrainingPreferences: async () => ({ preferences: { goal_type: 'muscle_gain' } }) } }));
let screen: any;
const text = () => screen.root.findAllByType(Text).map((t: any) => t.props.children).flat().join(' ');
const press = async (label: string) => { const node = screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function'); await act(async () => { await node.props.onPress(); }); };
const save = async () => { const node = screen.root.findAllByType(TouchableOpacity).find((n: any) => n.findAllByType(Text).some((t: any) => t.props.children === 'Save food targets')); await act(async () => { await node.props.onPress(); }); };
beforeEach(() => { jest.clearAllMocks(); (nutritionAPI.getProfile as jest.Mock).mockResolvedValue({ profile: null }); (nutritionAPI.updateProfile as jest.Mock).mockResolvedValue({ profile: { target_calories: 2400 } }); });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; });
const mount = async () => { await act(async () => { screen = create(<FitnessProfileScreen />); }); };
it('starts optional food setup with blank measurements and no invented target preview', async () => {
    await mount();
    for (const label of ['Height', 'Weight', 'Age']) expect(screen.root.findByProps({ accessibilityLabel: label }).props.value).toBe('');
    expect(text()).not.toContain('Target breakdown'); expect(text()).not.toContain('Your BMI');
    await save(); expect(nutritionAPI.updateProfile).not.toHaveBeenCalled(); expect(mockError).toHaveBeenCalledWith('Complete your food basics', expect.stringContaining('height'));
});
it('requires explicit food answers, then previews and saves the supplied measurements', async () => {
    await mount();
    for (const [label, value] of [['Height', '175'], ['Weight', '70'], ['Age', '25']]) await act(async () => { screen.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value); });
    await press('Male'); await press('Light'); await press('Vegetarian');
    expect(text()).toContain('Target breakdown'); await save();
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ height_cm: 175, weight_kg: 70, age: 25, gender: 'male', is_vegetarian: true, activity_level: 'light', goal_type: 'muscle_gain' }), 'session-a');
    expect(mockWeekly).not.toHaveBeenCalled();
});
it('a failed load blocks editing instead of guessing an existing profile', async () => {
    (nutritionAPI.getProfile as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await mount(); expect(text()).toContain('Retry before editing'); expect(text()).not.toContain('Your measurements');
});
it('preserves decimal measurements when editing an existing food profile', async () => {
    (nutritionAPI.getProfile as jest.Mock).mockResolvedValue({ profile: { height_cm: '175.5', weight_kg: '70.5', age: 25, gender: 'male', activity_level: 'light', goal_type: 'maintenance', is_vegetarian: false } });
    await mount(); expect(screen.root.findByProps({ accessibilityLabel: 'Weight' }).props.value).toBe('70.5');
    await save(); expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ height_cm: 175.5, weight_kg: 70.5 }), 'session-a');
    expect(mockWeekly).not.toHaveBeenCalled();
});
