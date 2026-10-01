import type { UserExercise } from '../components/workout';
import type { ShareExercise } from '../components/share/SharePayload';
import { finalizeWorkout } from './finalizeWorkout';

/** Preserve raw external-load volume; bodyweight work still has sets and reps. */
export function buildShareExercises(userExercises: UserExercise[]): ShareExercise[] {
    return finalizeWorkout(userExercises).map(ex => {
        const top = ex.sets.reduce((best, set) => {
            const weight = Number(set.weight_kg);
            const bestWeight = Number(best.weight_kg);
            return weight > bestWeight || (weight === bestWeight && Number(set.reps) > Number(best.reps)) ? set : best;
        });
        return {
            id: ex.id,
            name: ex.name,
            target: ex.target,
            volumeKg: ex.sets.reduce((sum, set) => sum + Number(set.weight_kg) * Number(set.reps) * (ex.is_unilateral ? 2 : 1), 0),
            setCount: ex.sets.length,
            topSet: { weight_kg: Number(top.weight_kg), reps: Number(top.reps) },
        };
    });
}
