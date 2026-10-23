import React from 'react';
import { Text, TextInput, TouchableOpacity, Modal, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import ProfileScreen from '../../../../app/(tabs)/profile';
import AIConsentModal, { AI_CONSENT_KEY, getAIConsent } from '../../../components/AIConsentModal';
import AvatarPicker from '../../../components/AvatarPicker';
import { memberAPI } from '../../../services/api';

const { create, act } = jest.requireActual('react-test-renderer');
const mockToast = { success: jest.fn(), info: jest.fn(), error: jest.fn() };
const mockRefresh = jest.fn();
let mockUser: { id: string; name: string; avatar_url?: string | null } = { id: 'me', name: 'Test' };
let mockFocus: () => void;
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void) => {
        mockFocus = callback;
        jest.requireActual('react').useEffect(callback, [callback]);
    },
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn(), refreshUser: mockRefresh }) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../../../components/WorkoutCalendar', () => () => null);
jest.mock('../../../components/FoodEntrySheet', () => () => null);
jest.mock('../../../services/api', () => ({
    memberAPI: { getHome: async () => ({ streak: { current: 0, history: [] } }), updateProfile: jest.fn() },
    caloriesAPI: { getToday: async () => ({ totals: {} }), getHistory: async () => ({ history: [] }) },
    nutritionAPI: { getProfile: async () => ({ profile: null }), getWeekly: async () => ({ summary: null }) },
    measurementsAPI: { getLatest: async () => ({ measurement: null }) },
    settingsAPI: {},
}));

let screen: any;
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const mount = async () => { await act(async () => { screen = create(<ProfileScreen />); }); };
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => {
    const button = control(label) || screen.root.findAllByType(TouchableOpacity).find((node: any) =>
        node.findAllByType(Text).some((text: any) => text.props.children === label));
    await act(async () => { await button.props.onPress(); });
};
const nameInput = () => screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Display name');
const inputName = async (value: string) => { await act(async () => nameInput().props.onChangeText(value)); };
const toggleAI = async (enabled: boolean) => { await act(async () => { await screen.root.findByType(Switch).props.onValueChange(enabled); }); };
const editor = () => screen.root.findAllByType(Modal).find((node: any) => node.props.presentationStyle === 'pageSheet');
beforeEach(async () => { jest.clearAllMocks(); mockUser = { id: 'me', name: 'Test' }; mockRefresh.mockResolvedValue(undefined); (memberAPI.updateProfile as jest.Mock).mockResolvedValue({}); await AsyncStorage.clear(); });
afterEach(async () => { await act(async () => screen?.unmount()); });

it('offers one Fitzo AI switch and asks for permission before enabling it', async () => {
    await mount();
    expect(texts().indexOf('Fitzo AI')).toBeLessThan(texts().indexOf('Activity History'));
    expect(texts()).toContain('Off · Manual logging still works');
    expect(screen.root.findByType(AIConsentModal).props.visible).toBe(false);
    await toggleAI(true);
    expect(screen.root.findByType(AIConsentModal).props.visible).toBe(true);
    expect(screen.root.findByType(Switch).props.value).toBe(false);
    expect(await getAIConsent()).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    await press('Enable Fitzo AI');
    expect(await getAIConsent()).toBe(true);
    expect(texts()).toContain('On for all AI features');
    expect(screen.root.findByType(AIConsentModal).props.visible).toBe(false);
});

it('reflects consent granted elsewhere on focus and lets the user disable AI from profile', async () => {
    await mount();
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    await act(async () => { mockFocus(); });
    expect(texts()).toContain('On for all AI features');
    await toggleAI(false);
    expect(await getAIConsent()).toBe(false);
    expect(texts()).toContain('Off · Manual logging still works');
    expect(screen.root.findByType(AIConsentModal).props.visible).toBe(false);
});

it('keeps the switch on and reports a failed attempt to save the off preference', async () => {
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    await mount();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
    await toggleAI(false);
    expect(await getAIConsent()).toBe(true);
    expect(screen.root.findByType(Switch).props.value).toBe(true);
    expect(mockToast.error).toHaveBeenCalledWith('Could not turn off AI', 'Please try again.');
});

it('preserves the default profile picture when only the display name changes', async () => {
    await mount(); await press('Edit profile');
    expect(screen.root.findByType(AvatarPicker).props.value).toBeNull();
    expect(control('Save changes').props.disabled).toBe(true);
    await inputName('  Ojas  '); await press('Save changes');
    expect(memberAPI.updateProfile).toHaveBeenCalledWith({ name: 'Ojas', avatar_url: null });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(editor().props.visible).toBe(false);
});

it('keeps a current photo while editing a name and can explicitly return to the default picture', async () => {
    mockUser.avatar_url = 'https://example.test/photo.jpg';
    await mount(); await press('Edit profile'); await inputName('Ojas'); await press('Save changes');
    expect(memberAPI.updateProfile).toHaveBeenCalledWith({ name: 'Ojas', avatar_url: mockUser.avatar_url });
    await press('Edit profile'); await press('Use default profile picture'); await press('Save changes');
    expect(memberAPI.updateProfile).toHaveBeenLastCalledWith({ name: 'Test', avatar_url: null });
});

it('validates the name and retains draft changes after a failed save', async () => {
    (memberAPI.updateProfile as jest.Mock).mockRejectedValueOnce(new Error('Connection unavailable. Try again.'));
    await mount(); await press('Edit profile'); await inputName('   '); await press('Save changes');
    expect(texts()).toContain('Enter a display name between 1 and 100 characters.');
    expect(memberAPI.updateProfile).not.toHaveBeenCalled();
    await inputName('Ojas'); await press('Lion avatar'); await press('Save changes');
    expect(texts()).toContain('Connection unavailable. Try again.');
    expect(editor().props.visible).toBe(true);
    expect(nameInput().props.value).toBe('Ojas');
    expect(screen.root.findByType(AvatarPicker).props.value).toBe('avatar_lion');
    await press('Save changes');
    expect(memberAPI.updateProfile).toHaveBeenCalledTimes(2);
    expect(editor().props.visible).toBe(false);
});

it('lets a member keep or discard unsaved edits without writing their profile', async () => {
    await mount(); await press('Edit profile'); await inputName('Changed'); await press('Close editor');
    expect(texts()).toContain('Discard your changes?');
    await press('Keep editing'); expect(nameInput().props.value).toBe('Changed');
    await press('Close editor'); await press('Discard changes');
    expect(editor().props.visible).toBe(false);
    expect(memberAPI.updateProfile).not.toHaveBeenCalled();
    await press('Edit profile'); expect(nameInput().props.value).toBe('Test');
    await press('Close editor'); expect(editor().props.visible).toBe(false);
});

it('blocks duplicate saves, edits and dismissal while a profile write is pending', async () => {
    let resolve!: () => void;
    (memberAPI.updateProfile as jest.Mock).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    await mount(); await press('Edit profile'); await inputName('Changed');
    await act(async () => { control('Save changes').props.onPress(); nameInput().props.onSubmitEditing(); });
    expect(memberAPI.updateProfile).toHaveBeenCalledTimes(1);
    expect(nameInput().props.editable).toBe(false);
    expect(screen.root.findByType(AvatarPicker).props.disabled).toBe(true);
    await act(async () => editor().props.onRequestClose());
    expect(editor().props.visible).toBe(true);
    expect(texts()).not.toContain('Discard your changes?');
    await act(async () => resolve());
    expect(editor().props.visible).toBe(false);
});
