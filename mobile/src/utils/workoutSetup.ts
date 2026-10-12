import type { UserExercise } from '../components/workout/types';
import { starterSessionDraft } from './starterWorkout';

export function parseWorkoutIntent(raw: unknown): { session_label: string; training_pattern?: string; emphasis?: string[] } | null {
    try {
        const value = typeof raw === 'string' ? JSON.parse(raw) : null;
        if (!value || typeof value.session_label !== 'string' || !value.session_label.trim() || value.session_label.length > 80) return null;
        return { session_label: value.session_label.trim(),
            training_pattern: typeof value.training_pattern === 'string' ? value.training_pattern : undefined,
            emphasis: Array.isArray(value.emphasis) ? value.emphasis.filter((item: unknown) => typeof item === 'string') : undefined };
    } catch { return null; }
}

export function previousWorkoutDraft(value: unknown): UserExercise[] | null {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return null; }
    }
    if (!Array.isArray(value)) return null;
    const draft = value.filter(ex => ex && typeof ex.name === 'string' && Array.isArray(ex.sets)).map((ex, index) => ({
        ...ex, sets: ex.sets.filter((set: any) => set && set.completed !== false && Number.isFinite(Number(set.weight_kg)) && Number(set.weight_kg) >= 0
            && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0).map((set: any, i: number) => ({
                ...set, id: `previous-${index}-${i}`, completed: false, previous: `${set.weight_kg}kg x ${set.reps}`,
            })),
    })).filter(ex => ex.sets.length > 0);
    return draft.length ? draft : null;
}

/** A user's last performed session takes priority over the initial suggestion.
 * A saved starting plan is a fallback for a day without a previous workout. */
export function chooseWorkoutDraft(previous: UserExercise[] | null, splits: any[], day: string, pattern?: string) {
    if (previous?.length) return { exercises: previous, source: 'previous' as const };
    const active = splits.find(split => split.is_active && (!pattern || split.split_id === pattern));
    const draft = active?.days?.includes(day) ? starterSessionDraft(active.training_plan, day) : null;
    return draft ? { exercises: draft, source: 'starter' as const } : null;
}
