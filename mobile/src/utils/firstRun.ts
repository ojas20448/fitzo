/**
 * One-shot "you can do this" tips.
 *
 * Persisted in AsyncStorage rather than component state so the tip survives a
 * remount, a tab switch and an app restart — a tip that reappears every visit
 * is worse than no tip at all.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'first_run_tip:';

export async function hasSeenTip(key: string): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(PREFIX + key)) === '1';
    } catch {
        // A storage failure should never block the screen. Treating it as
        // "already seen" errs toward silence instead of a tip on every launch.
        return true;
    }
}

export async function markTipSeen(key: string): Promise<void> {
    try {
        await AsyncStorage.setItem(PREFIX + key, '1');
    } catch {
        // Non-fatal: worst case the tip shows once more next launch.
    }
}

/** Test/debug helper — lets a tip be shown again. */
export async function resetTip(key: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(PREFIX + key);
    } catch {
        // Non-fatal.
    }
}

export const TIP_KEYS = {
    voiceWorkout: 'voice_workout',
    voiceCalories: 'voice_calories',
} as const;
