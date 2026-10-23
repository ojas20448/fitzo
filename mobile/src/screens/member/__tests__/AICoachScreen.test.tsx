import React from 'react';
import { Text, TextInput } from 'react-native';
import AICoachScreen from '../AICoachScreen';
import { aiAPI } from '../../../services/api';
import { getAIConsent } from '../../../components/AIConsentModal';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockEntry: Record<string, string> = {};
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => mockEntry }));
jest.mock('expo-audio', () => ({ useAudioRecorder: () => ({}), RecordingPresets: { HIGH_QUALITY: {} }, requestRecordingPermissionsAsync: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../../components/AIConsentModal', () => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return { __esModule: true, getAIConsent: jest.fn(), default: (props: any) => React.createElement(Text, { onPress: props.onAccept }, 'Shared AI consent') };
});
jest.mock('../../../services/api', () => ({ aiAPI: { getContextSummary: jest.fn(async () => null), getChatHistory: jest.fn(async () => ({ success: true, history: [] })), chat: jest.fn() } }));
let screen: any;
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
beforeEach(() => { jest.clearAllMocks(); mockEntry = {}; (getAIConsent as jest.Mock).mockResolvedValue(true); });
afterEach(async () => { await act(async () => screen?.unmount()); });
it('prefills an editable prompt without submitting a chat message', async () => {
    mockEntry = { source: 'food', prompt: 'Review my meals' };
    await act(async () => { screen = create(<AICoachScreen />); });
    expect(screen.root.findByType(TextInput).props.value).toBe('Review my meals');
    expect(aiAPI.chat).not.toHaveBeenCalled();
});
it('uses the shared consent source and does not fetch coach data before acceptance', async () => {
    (getAIConsent as jest.Mock).mockResolvedValue(false);
    await act(async () => { screen = create(<AICoachScreen />); });
    expect(getAIConsent).toHaveBeenCalled();
    expect(texts()).toContain('Shared AI consent');
    expect(aiAPI.getChatHistory).not.toHaveBeenCalled();
    expect(aiAPI.getContextSummary).not.toHaveBeenCalled();
});
it('labels a failed history load instead of implying a brand-new conversation', async () => {
    (aiAPI.getChatHistory as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { screen = create(<AICoachScreen />); });
    expect(texts()).toContain('Previous messages could not load');
    expect(screen.root.findAllByType(TextInput)).toHaveLength(1);
});
