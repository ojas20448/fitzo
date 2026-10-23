export interface ExerciseHistorySet { weight_kg: number; reps: number; rir?: number; }
export interface ExerciseHistorySession {
    id: string;
    date: string;
    createdAt?: string;
    workout: string;
    isUnilateral: boolean;
    sets: ExerciseHistorySet[];
}

export function exerciseHistoryFor(groups: unknown, name: string): ExerciseHistorySession[] {
    if (!Array.isArray(groups)) return [];
    const result: ExerciseHistorySession[] = [];
    for (const group of groups) {
        if (!group || typeof group.logged_date !== 'string' || !Number.isFinite(Date.parse(group.logged_date)) || !Array.isArray(group.workouts)) continue;
        for (const workout of group.workouts) {
            if (!workout || workout.completed === false) continue;
            let exercises = workout.exercises;
            if (typeof exercises === 'string') { try { exercises = JSON.parse(exercises); } catch { continue; } }
            if (!Array.isArray(exercises)) continue;
            exercises.forEach((exercise, index) => {
                if (typeof exercise?.name !== 'string' || exercise.name.trim().toLowerCase() !== name.trim().toLowerCase() || !Array.isArray(exercise.sets)) return;
                const sets = exercise.sets.flatMap((set: any) => {
                    if (!set || set.completed === false || set.weight_kg == null || String(set.weight_kg).trim() === '' || !Number.isFinite(Number(set.weight_kg)) || Number(set.weight_kg) < 0
                        || !Number.isInteger(Number(set.reps)) || Number(set.reps) <= 0) return [];
                    const rir = set.rir == null || String(set.rir).trim() === '' ? undefined : Number(set.rir);
                    return [{ weight_kg: Number(set.weight_kg), reps: Number(set.reps),
                        ...(Number.isInteger(rir) && rir! >= 0 && rir! <= 5 ? { rir } : {}) }];
                });
                if (sets.length) result.push({ id: `${workout.id}-${index}`, date: group.logged_date,
                    createdAt: typeof workout.created_at === 'string' ? workout.created_at : undefined,
                    workout: typeof workout.workout_type === 'string' ? workout.workout_type : 'Workout', isUnilateral: exercise.is_unilateral === true, sets });
            });
        }
    }
    return result.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)
        || Date.parse(b.createdAt || b.date) - Date.parse(a.createdAt || a.date));
}

/** Older servers do not order workouts within a day; avoid guessing which was last. */
export function latestExerciseSession(sessions: ExerciseHistorySession[]): ExerciseHistorySession | undefined {
    const first = sessions[0];
    if (!first) return undefined;
    const sameDay = sessions.filter(session => session.date === first.date);
    if (sameDay.length > 1 && sameDay.some(session => !session.createdAt || !Number.isFinite(Date.parse(session.createdAt)))) return undefined;
    return first;
}

export function exerciseHistoryDate(value: string): string {
    return new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
