import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type InputMode = 'wheel' | 'typing';
export const workoutInputModeKey = (userId: string) => `workout_input_mode_${userId}`;

export function useWorkoutInputMode(userId?: string) {
    const [preference, setPreference] = useState<{ userId?: string; mode: InputMode }>({ userId, mode: 'typing' });
    const identity = useRef(userId);
    const choice = useRef(0);
    const writes = useRef<Promise<unknown>>(Promise.resolve());
    // Reset synchronously so the first render of a different account cannot
    // open with the old account's preference while storage is still loading.
    if (identity.current !== userId) { identity.current = userId; choice.current++; }

    useEffect(() => {
        let active = true;
        const version = choice.current;
        if (userId) {
            AsyncStorage.getItem(workoutInputModeKey(userId)).then(value => {
                if (active && identity.current === userId && version === choice.current) {
                    setPreference({ userId, mode: value === 'wheel' ? 'wheel' : 'typing' });
                }
            }).catch(() => {});
        }
        return () => { active = false; };
    }, [userId]);

    const selectMode = useCallback((mode: InputMode) => {
        choice.current++;
        setPreference({ userId, mode });
        if (userId) {
            // Serialize rapid toggles; a slow old write cannot win over the
            // mode the user selected last. Failure affects persistence only.
            writes.current = writes.current.catch(() => {}).then(() =>
                AsyncStorage.setItem(workoutInputModeKey(userId), mode)
            ).catch(() => {});
        }
    }, [userId]);

    return { inputMode: preference.userId === userId ? preference.mode : 'typing', selectMode };
}
