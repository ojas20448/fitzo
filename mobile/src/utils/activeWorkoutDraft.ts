import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserExercise } from '../components/workout/types';

export interface ActiveWorkoutDraft {
    version: 1;
    intent: { session_label: string; training_pattern?: string };
    exercises: UserExercise[];
    startedAt: string;
    visibility: 'friends' | 'private';
    restDuration: number;
}

export const activeWorkoutDraftKey = (userId: string) => `@fitzo_active_workout_v1:${userId}`;
const writes = new Map<string, Promise<void>>();
type DraftListener = (userId: string, draft: ActiveWorkoutDraft | null) => void;
const listeners = new Set<DraftListener>();

export function subscribeActiveWorkoutDraft(listener: DraftListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function emitDraft(userId: string, draft: ActiveWorkoutDraft | null) {
    for (const listener of listeners) {
        try { listener(userId, draft); } catch { /* Notification UI cannot fail a workout backup. */ }
    }
}

// Serialize updates, including deletion, so an older write cannot revive a
// finished workout or overwrite the user's most recent set.
function enqueue(key: string, operation: () => Promise<void>): Promise<void> {
    const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
    writes.set(key, next);
    void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
    return next;
}

export function saveActiveWorkoutDraft(userId: string, draft: ActiveWorkoutDraft): Promise<void> {
    const key = activeWorkoutDraftKey(userId);
    const serialized = JSON.stringify(draft);
    return enqueue(key, async () => {
        await AsyncStorage.setItem(key, serialized);
        emitDraft(userId, JSON.parse(serialized));
    });
}

export function clearActiveWorkoutDraft(userId: string): Promise<void> {
    const key = activeWorkoutDraftKey(userId);
    return enqueue(key, async () => {
        await AsyncStorage.removeItem(key);
        emitDraft(userId, null);
    });
}

export async function loadActiveWorkoutDraft(userId: string): Promise<ActiveWorkoutDraft | null> {
    const key = activeWorkoutDraftKey(userId);
    await writes.get(key)?.catch(() => {});
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
        const draft = JSON.parse(raw);
        if (draft.version !== 1 || typeof draft.intent?.session_label !== 'string'
            || !Number.isFinite(Date.parse(draft.startedAt))
            || !['friends', 'private'].includes(draft.visibility)
            || !Number.isFinite(draft.restDuration) || draft.restDuration <= 0
            || !Array.isArray(draft.exercises)
            || !draft.exercises.every((ex: any) => typeof ex.id === 'string' && typeof ex.name === 'string'
                && Array.isArray(ex.sets) && ex.sets.every((set: any) => typeof set.id === 'string' && typeof set.completed === 'boolean'))) return null;
        return draft;
    } catch { return null; }
}
