import React from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import RegisterScreen from '../../../../app/register';
const { create, act } = jest.requireActual('react-test-renderer');
const mockRegister = jest.fn();
jest.mock('expo-router', () => ({
    router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
    useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ register: mockRegister }) }));
jest.mock('../../../components/ScreenBackdrop', () => () => null);
jest.mock('../../../utils/haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
let screen: any;
const text = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const field = (label: string) => screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label);
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => { await act(async () => { control(label).props.onPress(); }); };
const input = async (label: string, value: string) => { await act(async () => field(label).props.onChangeText(value)); };
async function details() { await input('Full name input', '  Ojas  '); await input('Email input', '  OJAS@example.test  '); await press('Continue'); }
async function passwords() { await input('Password input', 'Example123'); await input('Confirm password input', 'Example123'); }
beforeEach(async () => { jest.clearAllMocks(); mockRegister.mockResolvedValue(undefined); await act(async () => { screen = create(<RegisterScreen />); }); });
afterEach(async () => { await act(async () => screen.unmount()); });

test('starts with two fields and keeps gym membership optional', async () => {
    expect(screen.root.findAllByType(TextInput)).toHaveLength(2);
    await press('Continue');
    expect(text()).toContain('Enter your name'); expect(text()).toContain('Enter a valid email');
    expect(mockRegister).not.toHaveBeenCalled();
    await details();
    expect(field('Password input')).toBeTruthy();
    expect(text()).toContain('ojas@example.test');
});
test('editing the account preserves passwords and the optional gym code', async () => {
    await press('Add a gym code (optional)'); await input('Gym code input', '  GYM123  ');
    await details(); await passwords(); await press('Edit name, email or gym code');
    expect(field('Full name input').props.value).toBe('  Ojas  ');
    expect(field('Gym code input').props.value).toBe('  GYM123  ');
    await input('Email input', 'new@example.test'); await press('Continue');
    expect(field('Password input').props.value).toBe('Example123');
    await press('Create account');
    expect(mockRegister).toHaveBeenCalledWith('new@example.test', 'Example123', 'Ojas', 'GYM123');
    expect(router.replace).toHaveBeenCalledWith('/');
});
test('blocks weak or mismatched passwords and shows both fields when requested', async () => {
    await details(); await input('Password input', 'weak'); await input('Confirm password input', 'different');
    await press('Create account');
    expect(text()).toContain('Use 8 or more characters'); expect(text()).toContain('passwords don’t match');
    expect(mockRegister).not.toHaveBeenCalled();
    await press('Show passwords');
    expect(field('Password input').props.secureTextEntry).toBe(false);
    expect(field('Confirm password input').props.secureTextEntry).toBe(false);
    await press('Hide passwords');
    expect(field('Password input').props.secureTextEntry).toBe(true);
});
test('retains answers on a server error and supports retry', async () => {
    mockRegister.mockRejectedValueOnce(new Error('This email is already registered.'));
    await details(); await passwords(); await press('Create account');
    expect(text()).toContain('This email is already registered.');
    expect(field('Password input').props.value).toBe('Example123');
    expect(control('Create account').props.disabled).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    await press('Create account');
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenLastCalledWith('ojas@example.test', 'Example123', 'Ojas', '');
});
test('prevents duplicate submissions, including keyboard submit during a pending request', async () => {
    let resolve!: () => void;
    mockRegister.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    await details(); await passwords();
    await act(async () => { control('Create account').props.onPress(); field('Confirm password input').props.onSubmitEditing(); });
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(field('Password input').props.editable).toBe(false);
    await press('Edit account details');
    expect(field('Password input')).toBeTruthy();
    await act(async () => resolve());
    expect(router.replace).toHaveBeenCalledWith('/');
});
test('keyboard submit advances details and a direct visit can return to login', async () => {
    await press('Back to login');
    expect(router.replace).toHaveBeenCalledWith('/login');
    await input('Full name input', 'Ojas'); await input('Email input', 'ojas@example.test');
    await act(async () => field('Email input').props.onSubmitEditing());
    expect(field('Password input')).toBeTruthy();
});
