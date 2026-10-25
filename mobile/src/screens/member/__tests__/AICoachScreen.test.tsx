import React from 'react';
import { Text, TextInput } from 'react-native';
import AICoachScreen from '../AICoachScreen';
import { aiAPI } from '../../../services/api';
import { getAIConsent } from '../../../components/AIConsentModal';
import { requestRecordingPermissionsAsync } from 'expo-audio';
const { create, act } = jest.requireActual('react-test-renderer');
const mockRecorder = { prepareToRecordAsync: jest.fn(async () => {}), record: jest.fn(), stop: jest.fn(async () => {}), uri: 'file:///recording.m4a' };
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockEntry: Record<string, string> = {};
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => mockEntry }));
jest.mock('expo-audio', () => ({ useAudioRecorder: () => mockRecorder, RecordingPresets: { HIGH_QUALITY: {} }, requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })), setAudioModeAsync: jest.fn() }));
jest.mock('../../../utils/haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../../components/AIConsentModal', () => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return { __esModule: true, getAIConsent: jest.fn(), default: (props: any) => React.createElement(Text, { onPress: props.onAccept }, 'Shared AI consent') };
});
jest.mock('../../../services/api', () => ({ aiAPI: { getContextSummary: jest.fn(async () => null), getChatHistory: jest.fn(async () => ({ success: true, history: [] })), chat: jest.fn(), transcribeAudio: jest.fn() } }));
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
it('renders coach headings, emphasis and list items without literal Markdown markers', async () => {
    (aiAPI.getChatHistory as jest.Mock).mockResolvedValueOnce({ success: true, history: [{ id: 'reply', sender: 'assistant', message: '**Training:**\n\n1. **Consistency:** Keep your next session manageable.', created_at: '2026-10-25T00:00:00Z' }] });
    await act(async () => { screen = create(<AICoachScreen />); });
    expect(texts()).toContain('Training:');
    expect(texts()).toContain('Consistency:');
    expect(texts()).toContain('Keep your next session manageable.');
    expect(texts()).not.toContain('**Training:**');
    expect(texts()).not.toContain('**Consistency:**');
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

it('rechecks the shared permission before sending from an already-open coach', async () => {
    await act(async () => { screen = create(<AICoachScreen />); });
    await act(async () => { screen.root.findByType(TextInput).props.onChangeText('Review my week'); });
    (getAIConsent as jest.Mock).mockResolvedValue(false);
    const send = screen.root.findAllByProps({ accessibilityLabel: 'Send message' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => { await send.props.onPress(); });
    expect(aiAPI.chat).not.toHaveBeenCalled();
    expect(texts()).toContain('Shared AI consent');
});

it('does not start coach recording after AI is disabled elsewhere', async () => {
    await act(async () => { screen = create(<AICoachScreen />); });
    (getAIConsent as jest.Mock).mockResolvedValue(false);
    const record = screen.root.findAllByProps({ accessibilityLabel: 'Start recording' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => { await record.props.onPress(); });
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(texts()).toContain('Shared AI consent');
});

it('does not upload a coach recording if permission is revoked during recording', async () => {
    await act(async () => { screen = create(<AICoachScreen />); });
    const record = screen.root.findAllByProps({ accessibilityLabel: 'Start recording' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => { await record.props.onPress(); });
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    (getAIConsent as jest.Mock).mockResolvedValue(false);
    const stop = screen.root.findAllByProps({ accessibilityLabel: 'Stop recording' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => { await stop.props.onPress(); });
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    expect(aiAPI.transcribeAudio).not.toHaveBeenCalled();
    expect(texts()).toContain('Shared AI consent');
});
