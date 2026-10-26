import type { UserExercise } from '../components/workout/types';
import { isCardioExercise } from './cardio';

export interface CustomWorkoutPlan {
    version: 2;
    type: 'custom';
    tempo?: string;
    sessions: {
        day_name: string;
        exercises: {
            id?: string;
            name: string;
            target?: string;
            instructions?: string;
            set_count: number;
            reps_min?: number;
            reps_max?: number;
            tracking_type?: 'cardio';
            duration_minutes?: number;
            tempo?: string;
            is_unilateral?: boolean;
        }[];
    }[];
}

const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.length <= max;
const integer = (value: unknown, max: number) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= max;
const tempo = (value: unknown) => value === undefined || (typeof value === 'string' && /^\d{1,2}(-\d{1,2}){3}$/.test(value));
const dayKey = (value: string) => value.trim().toLowerCase();

/** Saved prescriptions are suggestions only. Never turn them into completed work. */
export function readCustomWorkoutPlan(value: unknown): CustomWorkoutPlan | null {
    if (!value || typeof value !== 'object') return null;
    const plan = value as CustomWorkoutPlan;
    if (plan.version !== 2 || plan.type !== 'custom' || !tempo(plan.tempo)
        || !Array.isArray(plan.sessions) || plan.sessions.length < 1 || plan.sessions.length > 7) return null;
    const days = new Set<string>();
    for (const session of plan.sessions) {
        if (!session || !text(session.day_name, 80) || days.has(dayKey(session.day_name))
            || !Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 30) return null;
        days.add(dayKey(session.day_name));
        for (const exercise of session.exercises) {
            if (!exercise || !text(exercise.name, 200) || !integer(exercise.set_count, 20)
                || (exercise.tracking_type === 'cardio'
                    ? !Number.isFinite(exercise.duration_minutes) || Number(exercise.duration_minutes) < 1 / 60 || Number(exercise.duration_minutes) > 1440
                    : !integer(exercise.reps_min, 100) || !integer(exercise.reps_max, 100) || Number(exercise.reps_min) > Number(exercise.reps_max))
                || (exercise.tracking_type !== undefined && exercise.tracking_type !== 'cardio')
                || !tempo(exercise.tempo) || (exercise.id !== undefined && !text(exercise.id, 100))
                || (exercise.target !== undefined && !text(exercise.target, 80))
                || (exercise.instructions !== undefined && !text(exercise.instructions, 2000))
                || (exercise.is_unilateral !== undefined && typeof exercise.is_unilateral !== 'boolean')) return null;
        }
    }
    return plan;
}

export function customSessionDraft(value: unknown, day: string, previous?: UserExercise[] | null): UserExercise[] | null {
    const plan = readCustomWorkoutPlan(value);
    const session = plan?.sessions.find(item => dayKey(item.day_name) === dayKey(day));
    if (!session) return null;
    return session.exercises.map((exercise, index) => {
        const id = exercise.id || `custom-${encodeURIComponent(session.day_name)}-${index}`;
        const last = previous?.find(item => dayKey(item.name) === dayKey(exercise.name));
        const range = exercise.reps_min === exercise.reps_max ? String(exercise.reps_min) : `${exercise.reps_min}–${exercise.reps_max}`;
        const exerciseTempo = exercise.tempo || plan?.tempo;
        const cardio = isCardioExercise(exercise);
        return {
            id, name: exercise.name, target: exercise.target, ...(cardio ? { tracking_type: 'cardio' as const } : {}), is_unilateral: !cardio && exercise.is_unilateral === true,
            instructions: [cardio ? `${exercise.set_count} cardio intervals${exercise.duration_minutes ? ` × ${exercise.duration_minutes} minutes` : ''}.` : `${exercise.set_count} working sets × ${range} reps${exercise.is_unilateral ? ' per side' : ''}.`,
                exerciseTempo ? `Tempo ${exerciseTempo}.` : '', exercise.instructions || ''].filter(Boolean).join(' '),
            sets: Array.from({ length: exercise.set_count }, (_, setIndex) => ({
                id: `${id}-${setIndex}`, weight_kg: last?.sets[setIndex]?.weight_kg ?? '',
                ...(cardio ? { duration_minutes: last?.sets[setIndex]?.duration_minutes ?? exercise.duration_minutes ?? '', rpe: '' } : {}),
                reps: last?.sets[setIndex]?.reps ?? (exercise.reps_min === exercise.reps_max ? exercise.reps_min : ''),
                previous: last?.sets[setIndex]?.previous, completed: false,
            })),
        };
    });
}
