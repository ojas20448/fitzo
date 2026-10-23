import React from 'react';
import { Modal, Platform, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import AIConsentModal, { AI_CONSENT_KEY, getAIConsent } from '../../components/AIConsentModal';
import { aiAPI } from '../../services/api';
import { useVoiceCapture, VoiceMode } from '../useVoiceCapture';

const { create, act } = jest.requireActual('react-test-renderer');
const mockRecorder = {
    prepareToRecordAsync: jest.fn(async () => {}),
    record: jest.fn(),
    stop: jest.fn(async () => {}),
    uri: 'file:///recording.m4a',
};
const mockOnResult = jest.fn();
const mockOnError = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-audio', () => ({
    useAudioRecorder: () => mockRecorder,
    useAudioRecorderState: () => ({ durationMillis: 1000 }),
    RecordingPresets: { HIGH_QUALITY: {} },
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => {}),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ base64: async () => 'audio-data' })) }));
jest.mock('../../utils/haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('../../services/api', () => ({ aiAPI: {
    transcribeAudio: jest.fn(async () => ({ text: 'a spoken log' })),
    extractFoods: jest.fn(async () => ({ items: [{ name: 'Dal' }] })),
    extractWorkout: jest.fn(async () => ({ workout: [{ name: 'Bench press' }] })),
} }));

let voice: ReturnType<typeof useVoiceCapture>;
let screen: any;
function Probe({ mode }: { mode: VoiceMode }) {
    voice = useVoiceCapture({ mode, onResult: mockOnResult, onError: mockOnError });
    return <AIConsentModal {...voice.consentModalProps} />;
}
const mount = async (mode: VoiceMode = 'food') => {
    await act(async () => { screen = create(<Probe mode={mode} />); });
};
const press = async (label: string) => {
    const button = screen.root.findAllByType(TouchableOpacity).find((node: any) =>
        node.findAllByType(Text).some((text: any) => text.props.children === label));
    await act(async () => { await button.props.onPress(); });
};
beforeEach(async () => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    await AsyncStorage.clear();
});
afterEach(async () => {
    await act(async () => screen?.unmount());
    jest.restoreAllMocks();
});

it.each<VoiceMode>(['food', 'workout'])('asks in place and continues %s voice logging after acceptance', async (mode) => {
    await mount(mode);
    expect(voice.consentModalProps.visible).toBe(false);
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    expect(voice.consentModalProps.visible).toBe(true);
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(aiAPI.transcribeAudio).not.toHaveBeenCalled();

    await press('Enable Fitzo AI');
    expect(await started).toBe(true);
    expect(await getAIConsent()).toBe(true);
    expect(voice.consentModalProps.visible).toBe(false);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    expect(voice.stage).toBe('recording');

    await act(async () => { await voice.stopAndProcess(); });
    expect(aiAPI.transcribeAudio).toHaveBeenCalledWith('audio-data', 'audio/mp4');
    expect(mode === 'food' ? aiAPI.extractFoods : aiAPI.extractWorkout).toHaveBeenCalledWith('a spoken log');
    expect(mockOnResult).toHaveBeenCalledWith([{ name: mode === 'food' ? 'Dal' : 'Bench press' }], 'a spoken log');
});

it('declining stays idle and another voice tap can request consent again', async () => {
    await mount();
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    await press('Not now');
    expect(await started).toBe(false);
    expect(voice.stage).toBe('idle');
    expect(await getAIConsent()).toBe(false);
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
    await act(async () => { void voice.start(); });
    expect(voice.consentModalProps.visible).toBe(true);
});

it('uses existing consent without showing another prompt', async () => {
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    await mount();
    await act(async () => { expect(await voice.start()).toBe(true); });
    expect(voice.consentModalProps.visible).toBe(false);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

it('reuses the same accepted permission when switching from food to workout logging', async () => {
    await mount('food');
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    await press('Enable Fitzo AI');
    expect(await started).toBe(true);
    await act(async () => { await voice.cancel(); screen.unmount(); });

    await mount('workout');
    await act(async () => { expect(await voice.start()).toBe(true); });
    expect(voice.consentModalProps.visible).toBe(false);
    expect(mockRecorder.record).toHaveBeenCalledTimes(2);
});

it('keeps AI disabled when saving consent fails and allows a retry', async () => {
    await mount();
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
    await press('Enable Fitzo AI');
    expect(voice.consentModalProps.visible).toBe(true);
    expect(await getAIConsent()).toBe(false);
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.root.findAllByType(Text).some((node: any) =>
        node.props.children === 'Could not save your AI preference. Please try again.')).toBe(true);
    await press('Enable Fitzo AI');
    expect(await started).toBe(true);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

it('rapid voice taps cannot start two recordings after consent', async () => {
    await mount();
    await act(async () => { void voice.start(); void voice.start(); });
    await press('Enable Fitzo AI');
    expect(requestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

it('rechecks consent before uploading audio and keeps the recording private if declined', async () => {
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    await mount();
    await act(async () => { await voice.start(); });
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'false');
    let processed!: Promise<void>;
    await act(async () => { processed = voice.stopAndProcess(); });
    expect(voice.consentModalProps.visible).toBe(true);
    expect(aiAPI.transcribeAudio).not.toHaveBeenCalled();
    await press('Not now');
    await processed;
    expect(voice.stage).toBe('idle');
    expect(aiAPI.transcribeAudio).not.toHaveBeenCalled();
    expect(mockOnResult).not.toHaveBeenCalled();
});

it('handles microphone permission denial after accepting consent without starting a recording', async () => {
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await mount();
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    await press('Enable Fitzo AI');
    expect(await started).toBe(false);
    expect(voice.stage).toBe('idle');
    expect(voice.isBusy).toBe(false);
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledWith('Microphone needed', expect.any(String));
});

it('waits for the iOS consent sheet to dismiss before starting the microphone', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await mount();
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    await press('Enable Fitzo AI');
    expect(voice.consentModalProps.visible).toBe(false);
    expect(voice.isAwaitingConsent).toBe(true);
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    await act(async () => { screen.root.findByType(Modal).props.onDismiss(); });
    expect(await started).toBe(true);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

it('leaving the screen while consent is pending cancels the requested recording', async () => {
    await mount();
    let started!: Promise<boolean>;
    await act(async () => { started = voice.start(); });
    await act(async () => { screen.unmount(); });
    expect(await started).toBe(false);
    expect(requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRecorder.record).not.toHaveBeenCalled();
});
