import type { UserExercise } from '../components/workout/types';
import { starterSessionDraft } from './starterWorkout';
import { customSessionDraft } from './savedWorkoutPlan';
import { cardioEntryError, cardioSetSummary, isCardioExercise } from './cardio';

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
        ...ex, sets: ex.sets.filter((set: any) => set && set.completed !== false && (isCardioExercise(ex)
            ? !cardioEntryError(set, 'duration') && !cardioEntryError(set, 'effort')
            : Number.isFinite(Number(set.weight_kg)) && Number(set.weight_kg) >= 0 && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0)).map((set: any, i: number) => ({
                ...set, ...(isCardioExercise(ex) ? { rpe: '' } : {}), id: `previous-${index}-${i}`, completed: false,
                previous: isCardioExercise(ex) ? cardioSetSummary(set) : `${set.weight_kg}kg x ${set.reps}`,
            })),
    })).filter(ex => ex.sets.length > 0);
    return draft.length ? draft : null;
}

/** Custom prescriptions own the exercise order and set count; history only
 * supplies matching previous values. Starter suggestions retain repeat-last behavior. */
export function chooseWorkoutDraft(previous: UserExercise[] | null, splits: any[], day: string, pattern?: string) {
    const active = splits.find(split => split.is_active && (!pattern || split.split_id === pattern));
    const matchesDay = Array.isArray(active?.days) && active.days.some((item: unknown) => typeof item === 'string' && item.trim().toLowerCase() === day.trim().toLowerCase());
    const custom = matchesDay ? customSessionDraft(active.training_plan, day, previous) : null;
    if (custom) return { exercises: custom, source: 'template' as const };
    if (previous?.length) return { exercises: previous, source: 'previous' as const };
    const draft = matchesDay ? starterSessionDraft(active.training_plan, day.trim()) : null;
    return draft ? { exercises: draft, source: 'starter' as const } : null;
}
