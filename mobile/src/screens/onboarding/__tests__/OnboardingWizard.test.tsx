import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import OnboardingWizard from '../OnboardingWizard';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ completeOnboarding: jest.fn() }) }));
jest.mock('../../../services/healthService', () => ({ isHealthAvailable: () => false }));
jest.mock('../../../services/api', () => ({ nutritionAPI: {}, workoutsAPI: {}, healthAPI: {} }));
it('offers an egg-free vegetarian choice and exposes its selected state', async () => {
    let screen: any;
    await act(async () => { screen = create(<OnboardingWizard />); });
    try {
        await act(async () => {
            for (const [placeholder, value] of [['175', '175'], ['70', '70'], ['25', '25']]) {
                screen.root.findAllByType(TextInput).find((n: any) => n.props.placeholder === placeholder).props.onChangeText(value);
            }
        });
        await act(async () => {
            screen.root.findAllByType(TouchableOpacity).find((n: any) => n.findAllByType(Text).some((t: any) => t.props.children === 'Continue')).props.onPress();
        });
        const label = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'Vegetarian');
        const choice = label.parent;
        expect(choice.findAllByType(Text).some((n: any) => n.props.children === '🥚')).toBe(false);
        expect(choice.props.accessibilityRole).toBe('radio');
        const control = screen.root.findAllByProps({ accessibilityLabel: 'Vegetarian' }).find((n: any) => typeof n.props.onPress === 'function');
        await act(async () => control.props.onPress());
        expect(control.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    } finally { await act(async () => screen.unmount()); }
});
