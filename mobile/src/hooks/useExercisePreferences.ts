import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken, settingsAPI, type ExercisePreference } from '../services/api';

export function useExercisePreferences(userId?: string) {
    const [state, setState] = useState<{ owner?: string; values: Record<string, ExercisePreference>; loading: boolean; error: boolean }>({ owner: userId, values: {}, loading: true, error: false });
    const identity = useRef(userId);
    const version = useRef(0);
    const mounted = useRef(true);
    if (identity.current !== userId) { identity.current = userId; version.current++; }
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const reload = useCallback(async () => {
        if (!userId) return;
        const request = ++version.current;
        setState(current => ({ owner: userId, values: current.owner === userId ? current.values : {}, loading: true, error: false }));
        try {
            const response = await settingsAPI.getExercisePreferences();
            if (mounted.current && identity.current === userId && request === version.current) setState({ owner: userId, values: Object.fromEntries(response.preferences.map(preference => [preference.exercise_name, preference])), loading: false, error: false });
        } catch {
            if (mounted.current && identity.current === userId && request === version.current) setState(current => ({ ...current, loading: false, error: true }));
        }
    }, [userId]);
    useEffect(() => { void reload(); return () => { version.current++; }; }, [reload]);
    const save = useCallback(async (preference: ExercisePreference) => {
        const token = await getAuthToken();
        if (!userId || !token || !mounted.current || identity.current !== userId) throw new Error('Your session changed. Please sign in again.');
        version.current++;
        const response = await settingsAPI.updateExercisePreference(preference, token);
        if (!mounted.current || identity.current !== userId) throw new Error('Your session changed. Please sign in again.');
        setState(current => ({ owner: userId, values: { ...(current.owner === userId ? current.values : {}), [response.preference.exercise_name]: response.preference }, loading: false, error: false }));
    }, [userId]);
    return { preferences: state.owner === userId ? state.values : {}, loading: state.owner !== userId || state.loading, error: state.owner === userId && state.error, reload, save };
}
