import { useCallback, useEffect, useRef, useState } from 'react';
import {
    useAudioRecorder,
    useAudioRecorderState,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from '../utils/haptics';
import { aiAPI } from '../services/api';

/**
 * useVoiceCapture — one voice pipeline for the whole app.
 *
 * Record → transcribe → extract structured items, with the states the UI needs
 * to stay honest at every step (idle / recording / transcribing / thinking).
 *
 * Notes on the platform details this encapsulates:
 * - Built on `expo-audio`. `expo-av` is deprecated in SDK 54 and removed in 55.
 * - Recordings are .m4a; the correct MIME is `audio/mp4`. Gemini rejects the
 *   commonly-guessed `audio/m4a`, which silently 400s every request.
 * - `expo-file-system` v19 dropped `readAsStringAsync`; base64 now comes from
 *   `new File(uri).base64()`.
 */

export type VoiceStage = 'idle' | 'recording' | 'transcribing' | 'thinking';
export type VoiceMode = 'food' | 'workout';

// Guard rails that match the backend schema (3MB base64 ≈ 2 min of speech).
const MAX_DURATION_MS = 90_000;
const MIN_DURATION_MS = 700;

interface UseVoiceCaptureOptions {
    mode: VoiceMode;
    /** Fires with the extracted items once the pipeline succeeds. */
    onResult: (items: any[], transcript: string) => void;
    /** Fires with a human-readable message. Never a raw stack. */
    onError: (title: string, message: string) => void;
}

export function useVoiceCapture({ mode, onResult, onError }: UseVoiceCaptureOptions) {
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);
    const [stage, setStage] = useState<VoiceStage>('idle');

    // Set when the user cancels, so the in-flight stop() knows to discard.
    const cancelledRef = useRef(false);
    const durationMs = recorderState.durationMillis ?? 0;

    const start = useCallback(async () => {
        try {
            const perm = await requestRecordingPermissionsAsync();
            if (!perm.granted) {
                onError('Microphone needed', 'Enable mic access in Settings to log by voice.');
                return;
            }

            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            recorder.record();

            cancelledRef.current = false;
            setStage('recording');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
            setStage('idle');
            onError('Could not start', 'Something went wrong with the microphone.');
        }
    }, [recorder, onError]);

    /** Discard the take — no transcription, no quota burned. */
    const cancel = useCallback(async () => {
        cancelledRef.current = true;
        try {
            await recorder.stop();
        } catch {
            /* already stopped */
        }
        setStage('idle');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [recorder]);

    const stopAndProcess = useCallback(async () => {
        if (stage !== 'recording') return;

        // Too short to contain speech — treat as a mis-tap, not an error.
        if (durationMs < MIN_DURATION_MS) {
            await cancel();
            onError('Too short', 'Hold on and say what you ate or lifted.');
            return;
        }

        setStage('transcribing');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        let uri: string | null = null;
        try {
            await recorder.stop();
            uri = recorder.uri;
            if (cancelledRef.current) {
                setStage('idle');
                return;
            }
            if (!uri) throw new Error('no-uri');

            const base64 = await new File(uri).base64();

            const transcribed = await aiAPI.transcribeAudio(base64, 'audio/mp4');
            const transcript = String(transcribed?.text || '').trim();
            if (!transcript) {
                setStage('idle');
                onError("Didn't catch that", 'Try again a little closer to the mic.');
                return;
            }

            setStage('thinking');
            const extracted =
                mode === 'food'
                    ? await aiAPI.extractFoods(transcript)
                    : await aiAPI.extractWorkout(transcript);

            const items = mode === 'food' ? extracted?.items : extracted?.workout;
            const list = Array.isArray(items) ? items : [];

            if (list.length === 0) {
                setStage('idle');
                onError(
                    'Nothing to log',
                    mode === 'food'
                        ? `Heard "${transcript}" — but no food in it. Try "two roti and dal".`
                        : `Heard "${transcript}" — but no exercises in it. Try "3 sets bench press 60 kilos".`
                );
                return;
            }

            setStage('idle');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onResult(list, transcript);
        } catch (err: any) {
            setStage('idle');
            // Surface the server's friendly message when there is one.
            const serverMsg = err?.response?.data?.message;
            const status = err?.response?.status;
            if (status === 429) {
                onError('Slow down', serverMsg || "You've hit today's AI limit.");
            } else {
                onError('Voice logging failed', serverMsg || 'Check your connection and try again.');
            }
        }
    }, [stage, durationMs, recorder, mode, onResult, onError, cancel]);

    // Hard stop at the max length so a pocket-recording can't run forever
    // (and can't exceed the backend's payload cap).
    useEffect(() => {
        if (stage === 'recording' && durationMs >= MAX_DURATION_MS) {
            stopAndProcess();
        }
    }, [stage, durationMs, stopAndProcess]);

    return {
        stage,
        isRecording: stage === 'recording',
        isBusy: stage === 'transcribing' || stage === 'thinking',
        durationMs,
        /** mm:ss for the live counter */
        durationLabel: formatDuration(durationMs),
        /** 0..1 — how close to the hard cap, for the progress ring */
        durationProgress: Math.min(1, durationMs / MAX_DURATION_MS),
        metering: recorderState.metering,
        start,
        cancel,
        stopAndProcess,
    };
}

function formatDuration(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
