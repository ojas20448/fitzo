import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import OnboardingWizard from '../OnboardingWizard';
import { nutritionAPI, workoutsAPI, getAuthToken } from '../../../services/api';
import { readOnboardingDraft, clearOnboardingDraft } from '../../../utils/onboardingDraft';
import { getPendingInvite } from '../../../utils/buddyInvite';
const { create, act } = jest.requireActual('react-test-renderer');
const mockComplete = jest.fn();
const mockWeeklyGoal = jest.fn();
const mockRefresh = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' }, completeOnboarding: mockComplete }) }));
jest.mock('../../../context/NutritionContext', () => ({ useNutrition: () => ({ updateWeeklyGoal: mockWeeklyGoal, refreshToday: mockRefresh }) }));
jest.mock('../../../utils/onboardingDraft', () => ({ readOnboardingDraft: jest.fn(), writeOnboardingDraft: jest.fn(), clearOnboardingDraft: jest.fn() }));
jest.mock('../../../services/api', () => ({ getAuthToken: jest.fn(), nutritionAPI: { updateProfile: jest.fn() }, workoutsAPI: { saveSplit: jest.fn(), saveTrainingPreferences: jest.fn() } }));
jest.mock('../../../utils/buddyInvite', () => ({ getPendingInvite: jest.fn() }));

let screen: any;
const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const continueStep = async () => { await act(async () => screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === 'Continue')).props.onPress()); };
const input = async (label: string, value: string) => { await act(async () => screen.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value)); };
const text = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ').replace(/\s+/g, ' ');
const validForm = { goal: 'maintenance', days: 3, experience: 'new', equipment: 'gym', sessionMinutes: 35, activity: 'sedentary', height: '175', weight: '70', age: '25', gender: 'male', vegetarian: true, customCalories: '', nutritionEnabled: true };

beforeEach(() => {
    jest.clearAllMocks();
    (getAuthToken as jest.Mock).mockResolvedValue('session-a');
    (workoutsAPI.saveTrainingPreferences as jest.Mock).mockResolvedValue({});
    (readOnboardingDraft as jest.Mock).mockResolvedValue(null);
    (clearOnboardingDraft as jest.Mock).mockResolvedValue(undefined);
    (getPendingInvite as jest.Mock).mockResolvedValue(null);
    (workoutsAPI.saveSplit as jest.Mock).mockResolvedValue({ split: { id: '00000000-0000-4000-8000-000000000001' } });
    (nutritionAPI.updateProfile as jest.Mock).mockResolvedValue({ profile: {} });
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; });
async function mount(draft?: object) {
    if (draft) (readOnboardingDraft as jest.Mock).mockResolvedValue(JSON.stringify({ version: 1, ...draft }));
    await act(async () => { screen = create(<OnboardingWizard />); });
}
async function finish(label = 'Start my first workout') {
    const control = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((item: any) => item.props.children === label));
    await act(async () => { await control.props.onPress(); });
}

it('starts with the goal and requires a choice before continuing', async () => {
    await mount();
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    await continueStep();
    expect(text()).toContain('Choose what you would like to work on.');
    await press('Maintain'); await continueStep();
    expect(text()).toContain('How many days can you train?');
});

it('lets a member revise their goal from the plan without losing their routine or food answers', async () => {
    await mount({ step: 4, form: validForm });
    await press('Edit your goal');
    await press('Build muscle'); await continueStep();
    expect(button('3 training days per week').props.accessibilityState.checked).toBe(true);
    expect(button('About 35 minutes').props.accessibilityState.checked).toBe(true);
    await continueStep();
    expect(screen.root.findByProps({ accessibilityLabel: 'Height in centimetres' }).props.value).toBe('175');
    await continueStep(); await finish();
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ goal_type: 'muscle_gain', height_cm: 175 }), 'session-a');
});

it('keeps the vegetarian choice accessible and preserves answers when going back', async () => {
    await mount(); await press('Maintain'); await continueStep();
    await press('3 training days per week');
    await press('Choose training experience'); await press('Just starting');
    await press('Choose training equipment'); await press('Gym equipment');
    await press('About 35 minutes'); await continueStep();
    await press('Add food targets (optional)');
    await press('Choose everyday activity'); await press('Mostly sitting');
    await input('Height in centimetres', '175'); await input('Weight', '70'); await input('Age', '25');
    await press('Male'); await press('Vegetarian');
    expect(button('Vegetarian').props.accessibilityState).toMatchObject({ selected: true, checked: true });
    expect(text()).not.toContain('🥚');
    await continueStep();
    expect(text()).toContain('126');
    expect(text()).toContain('Full Body A');
    await press('Previous step');
    expect(screen.root.findByProps({ accessibilityLabel: 'Weight' }).props.value).toBe('70');
});

it('restores an account draft and saves the same schedule shown in the preview', async () => {
    await mount({ step: 4, form: { ...validForm, days: 4 } });
    expect(readOnboardingDraft).toHaveBeenCalledWith('account-a');
    await finish();
    expect(workoutsAPI.saveSplit).toHaveBeenCalledWith(expect.objectContaining({ split_id: 'upper_lower', name: 'Upper / Lower · 4 days', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B'], days_per_week: 4,
        training_plan: expect.objectContaining({ preferences: { experience: 'new', equipment: 'gym', session_minutes: 35 }, sessions: expect.arrayContaining([expect.objectContaining({ day_name: 'Upper A', exercises: expect.arrayContaining([{ id: 'chest_press_machine', set_count: 2, reps: 10 }]) })]) }) }), 'session-a');
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ weight_kg: 70, calorie_target_mode: 'automatic', macro_target_mode: 'automatic', is_vegetarian: true }), 'session-a');
    expect(mockWeeklyGoal).toHaveBeenCalledWith(4);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(clearOnboardingDraft).toHaveBeenCalledWith('account-a');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/log/workout', params: { intent: JSON.stringify({ session_label: 'Upper A', emphasis: ['Upper A'], training_pattern: 'upper_lower' }) } });
});

it('preserves a centimetre height through unit switches and submits centimetres', async () => {
    await mount({ step: 3, form: { ...validForm, height: '182.5' } });
    await press('Height in centimetres. Switch to feet and inches');
    expect(screen.root.findByProps({ accessibilityLabel: 'Feet' }).props.value).toBe('5');
    await press('Height in feet and inches. Switch to centimetres');
    expect(screen.root.findByProps({ accessibilityLabel: 'Height in centimetres' }).props.value).toBe('182.5');
    await continueStep(); await finish();
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ height_cm: 182.5 }), 'session-a');
});

it('clears the previous height error when units change and explains imperial input errors', async () => {
    await mount({ step: 3, form: { ...validForm, height: '' } });
    await continueStep();
    expect(text()).toContain('Enter a height between 100 and 250 cm.');
    await press('Height in centimetres. Switch to feet and inches');
    expect(text()).not.toContain('Enter a height between 100 and 250 cm.');
    await input('Feet', '5'); await input('Inches', '15'); await continueStep();
    expect(text()).toContain('Inches must be between 0 and 11.');
    expect(text()).not.toContain('Your starting plan.');
    await input('Inches', '9'); await continueStep(); await finish();
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ height_cm: 175.26 }), 'session-a');
});

it.each([new Error('Connection lost. Try again.'), { message: 'Connection lost. Try again.', code: 'NETWORK_ERROR', status: 0 }])('shows the save error and keeps setup retryable (%#)', async error => {
    (workoutsAPI.saveSplit as jest.Mock).mockRejectedValueOnce(error);
    await mount({ step: 4, form: validForm }); await finish();
    expect(nutritionAPI.updateProfile).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(text()).toContain('Connection lost. Try again.');
    await finish('Log a meal first');
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/log/calories');
});

it.each([null, {}, { message: 400 }])('keeps a fallback message for an unexpected save failure (%#)', async error => {
    (workoutsAPI.saveSplit as jest.Mock).mockRejectedValueOnce(error);
    await mount({ step: 4, form: validForm }); await finish();
    expect(text()).toContain('Could not save your plan. Your answers are kept here; please try again.');
    expect(mockComplete).not.toHaveBeenCalled();
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
});

it('retries a profile failure without saving the same split twice', async () => {
    (nutritionAPI.updateProfile as jest.Mock).mockRejectedValueOnce(new Error('Try again'));
    await mount({ step: 4, form: validForm }); await finish();
    expect(mockComplete).not.toHaveBeenCalled();
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    await finish();
    expect(workoutsAPI.saveSplit).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
});

it('preserves a pending buddy invite instead of racing it with first-workout navigation', async () => {
    (getPendingInvite as jest.Mock).mockResolvedValue({ id: 'friend-account', u: 'buddy' });
    await mount({ step: 4, form: validForm }); await finish();
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.push).not.toHaveBeenCalled();
});

it('blocks invalid custom calories before saving and keeps the custom input available', async () => {
    await mount({ step: 4, form: { ...validForm, customCalories: 'invalid' } }); await finish();
    expect(workoutsAPI.saveSplit).not.toHaveBeenCalled();
    expect(screen.root.findByProps({ accessibilityLabel: 'Custom daily calories (optional)' })).toBeDefined();
    await input('Custom daily calories (optional)', '2200'); await finish();
    expect(nutritionAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ calorie_target_mode: 'custom', target_calories: 2200 }), 'session-a');
});

it('uses three screens for training and saves completion without measurements or food targets', async () => {
    await mount({ step: 2, form: { ...validForm, height: '', weight: '', age: '', gender: null, vegetarian: null, activity: null, nutritionEnabled: false } });
    await continueStep();
    expect(text()).toContain('3 of 3');
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    expect(text()).not.toContain('kcal');
    await finish();
    expect(nutritionAPI.updateProfile).not.toHaveBeenCalled();
    expect(workoutsAPI.saveTrainingPreferences).toHaveBeenCalledWith({ preferences: { experience: 'new', equipment: 'gym', session_minutes: 35, goal_type: 'maintenance' }, expected_split_id: '00000000-0000-4000-8000-000000000001', complete_setup: true }, 'session-a');
    expect(mockComplete).toHaveBeenCalledTimes(1);
});

it('can add food basics voluntarily and skip them without losing training choices', async () => {
    await mount({ step: 4, form: { ...validForm, nutritionEnabled: false } });
    await press('Add food targets (optional)');
    expect(text()).toContain('3 of 4');
    expect(screen.root.findByProps({ accessibilityLabel: 'Weight' }).props.value).toBe('70');
    await press('Set up food later');
    expect(text()).toContain('3 of 3');
    await press('Previous step');
    expect(text()).toContain('2 of 3');
    await continueStep(); await finish();
    expect(nutritionAPI.updateProfile).not.toHaveBeenCalled();
});

it('keeps the preview and retries server completion without creating another routine', async () => {
    (workoutsAPI.saveTrainingPreferences as jest.Mock).mockRejectedValueOnce(new Error('Could not finish setup.'));
    await mount({ step: 4, form: { ...validForm, nutritionEnabled: false } }); await finish();
    expect(mockComplete).not.toHaveBeenCalled(); expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(text()).toContain('Could not finish setup.');
    await finish(); expect(workoutsAPI.saveSplit).toHaveBeenCalledTimes(1); expect(mockComplete).toHaveBeenCalledTimes(1);
});
it('does not keep users in setup while the non-critical food summary is loading', async () => {
    mockRefresh.mockReturnValueOnce(new Promise(() => {}));
    await mount({ step: 4, form: { ...validForm, nutritionEnabled: false } }); await finish();
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/log/workout' }));
});
