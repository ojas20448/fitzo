import * as ExpoHaptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Central haptics gate — every Haptics.* call in the app goes through here so
 * the Settings toggle actually silences the whole app, not just the screens
 * that remembered to check a flag.
 *
 * Same surface as expo-haptics for the five members the app uses, so migrating
 * a call site is nothing more than changing the import path.
 *
 * The setting fails open (vibrations on) until proven otherwise, so a slow
 * AsyncStorage read at launch never eats a tab-press buzz.
 */

const HAPTICS_ENABLED_KEY = 'fitzo:haptics_enabled';

let enabled = true;

export async function loadHapticsSetting(): Promise<void> {
    try {
        const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
        enabled = stored !== 'false';
    } catch {
        enabled = true;
    }
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
    enabled = value;
    try {
        await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(value));
    } catch {
        // Persistence failed — keep the in-session value anyway.
    }
}

export const isHapticsEnabled = (): boolean => enabled;

export const impactAsync = (
    style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium
): Promise<void> => (enabled ? ExpoHaptics.impactAsync(style) : Promise.resolve());

export const notificationAsync = (
    type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
): Promise<void> => (enabled ? ExpoHaptics.notificationAsync(type) : Promise.resolve());

export const selectionAsync = (): Promise<void> =>
    enabled ? ExpoHaptics.selectionAsync() : Promise.resolve();

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
