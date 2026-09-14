import type { UserExercise } from '../components/workout';

/** One completed-set contract for the saved workout, recap and share cards. */
export function finalizeWorkout(exercises: UserExercise[]): UserExercise[] {
    return exercises.map(ex => ({
        ...ex,
        sets: ex.sets.filter(set => {
            const weight = Number(set.weight_kg ?? 0);
            const reps = Number(set.reps);
            return set.completed === true && Number.isFinite(weight) && weight >= 0
                && Number.isInteger(reps) && reps > 0;
        }).map(set => ({ ...set, weight_kg: Number(set.weight_kg ?? 0), reps: Number(set.reps) })),
    })).filter(ex => ex.sets.length > 0);
}
