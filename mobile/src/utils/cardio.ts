import { defaultExercises } from '../data/defaultExercises';
import type { ExerciseSet } from '../components/workout/types';
import { workoutNumber } from './workoutNumber';

type ExerciseKind = { id?: string; name?: string; bodyPart?: string; category?: string; target?: string; tracking_type?: string };
const cardioExercises = defaultExercises.filter(exercise => exercise.bodyPart === 'cardio');

export function isCardioExercise(exercise: ExerciseKind): boolean {
    if (exercise.tracking_type) return exercise.tracking_type === 'cardio';
    return (exercise.bodyPart || exercise.category)?.trim().toLowerCase() === 'cardio' || /^cardiovascular(?: system)?$/i.test(exercise.target?.trim() || '')
        || cardioExercises.some(item => item.id === exercise.id || item.name.toLowerCase() === exercise.name?.trim().toLowerCase());
}

export function cardioEntryError(set: Pick<ExerciseSet, 'duration_minutes' | 'rpe'>, field: 'duration' | 'effort'): string {
    if (field === 'duration') {
        const minutes = workoutNumber(set.duration_minutes);
        return Number.isFinite(minutes) && minutes >= 1 / 60 && minutes <= 1440 ? '' : 'Enter a duration between 1 second and 1,440 minutes.';
    }
    if (set.rpe == null || String(set.rpe).trim() === '') return '';
    const effort = workoutNumber(set.rpe);
    return Number.isInteger(effort) && effort >= 1 && effort <= 10 ? '' : 'Effort must be 1–10, or left empty.';
}

export function cardioSetSummary(set: Pick<ExerciseSet, 'duration_minutes' | 'rpe'>): string {
    return `${set.duration_minutes} min${set.rpe == null || String(set.rpe).trim() === '' ? '' : ` · effort ${set.rpe}/10`}`;
}
