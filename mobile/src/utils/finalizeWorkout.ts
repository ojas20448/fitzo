import type { UserExercise } from '../components/workout';
import { cardioEntryError, isCardioExercise } from './cardio';
import { workoutNumber } from './workoutNumber';

/** One completed-set contract for the saved workout, recap and share cards. */
export function finalizeWorkout(exercises: UserExercise[]): UserExercise[] {
    return exercises.map(ex => ({
        ...ex,
        ...(isCardioExercise(ex) ? { tracking_type: 'cardio' as const, is_unilateral: false } : {}),
        sets: ex.sets.filter(set => {
            if (isCardioExercise(ex)) return set.completed === true && !cardioEntryError(set, 'duration') && !cardioEntryError(set, 'effort');
            const weight = Number(set.weight_kg ?? 0);
            const reps = Number(set.reps);
            return set.completed === true && Number.isFinite(weight) && weight >= 0
                && Number.isInteger(reps) && reps > 0;
        }).map(set => {
            if (!isCardioExercise(ex)) return { ...set, weight_kg: Number(set.weight_kg ?? 0), reps: Number(set.reps) };
            const { weight_kg, reps, rir, rpe, ...timed } = set;
            return { ...timed, duration_minutes: workoutNumber(set.duration_minutes),
                ...(rpe == null || String(rpe).trim() === '' ? {} : { rpe: workoutNumber(rpe) }) };
        }),
    })).filter(ex => ex.sets.length > 0);
}
