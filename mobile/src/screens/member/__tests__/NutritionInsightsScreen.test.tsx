import React from 'react';
import { Text } from 'react-native';
import NutritionInsightsScreen from '../NutritionInsightsScreen';
import { nutritionAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a' } }) }));
jest.mock('../../../components/WeeklyCharts', () => () => null);
jest.mock('../../../services/api', () => ({ nutritionAPI: { getToday: jest.fn(), getProfile: jest.fn() } }));
let screen: any;
const text = () => screen.root.findAllByType(Text).map((t: any) => t.props.children).flat().join(' ');
const logged = { calories: 400, protein: 15, carbs: 50, fat: 10 };
beforeEach(() => { jest.clearAllMocks(); (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ targets: null, logged }); (nutritionAPI.getProfile as jest.Mock).mockResolvedValue({ profile: null }); });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; });
const mount = async () => { await act(async () => { screen = create(<NutritionInsightsScreen />); }); };
it('lets training-only users log food and opt into targets without inventing a nutrition assessment', async () => {
    await mount(); expect(text()).toContain('Food targets are optional'); expect(text()).toContain('400'); expect(text()).toContain('Log food without targets');
    expect(text()).not.toContain('Deficit'); expect(text()).not.toContain('2000');
});
it('shows failed reads as retryable instead of treating them as skipped setup', async () => {
    (nutritionAPI.getToday as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await mount(); expect(text()).toContain('Could not load your food details'); expect(text()).toContain('Retry'); expect(text()).not.toContain('Food targets are optional');
});
it('compares logged food with the saved target without guessed exercise credits or energy-balance claims', async () => {
    (nutritionAPI.getToday as jest.Mock).mockResolvedValue({ logged, targets: { calories: 1800, protein: 110, carbs: 220, fat: 60 } });
    (nutritionAPI.getProfile as jest.Mock).mockResolvedValue({ profile: { weight_kg: 70 } });
    await mount(); expect(text()).toContain('Remaining'); expect(text()).toContain('1400'); expect(text()).toContain('Logged so far');
    expect(text()).not.toContain('Burnt'); expect(text()).not.toContain('Maintenance'); expect(text()).not.toContain('Deficit'); expect(text()).not.toContain('Surplus');
});
