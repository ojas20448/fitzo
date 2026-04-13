/**
 * Shared types for workout logging features
 */

export interface ExerciseSet {
    id: string;
    weight_kg?: number | string;
    reps?: number | string;
    rir?: number | string;
    completed: boolean;
    previous?: string;
}

export interface UserExercise {
    id: string;
    name: string;
    gifUrl?: string;
    target?: string;
    sets: ExerciseSet[];
}

export interface PickerConfig {
    visible: boolean;
    type: 'weight' | 'reps';
    exerciseIndex: number;
    setIndex: number;
    currentValue: number;
}

export const WORKOUT_TYPES = ['legs', 'chest', 'back', 'shoulders', 'arms', 'cardio'] as const;
export const REST_PRESETS = [60, 90, 120, 180] as const;
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 300;
export const WEIGHT_STEP = 0.5;
export const REPS_MIN = 0;
export const REPS_MAX = 100;

// Pre-compute weight values once
export const WEIGHT_VALUES = Array.from(
    { length: (WEIGHT_MAX - WEIGHT_MIN) / WEIGHT_STEP + 1 },
    (_, i) => WEIGHT_MIN + i * WEIGHT_STEP,
);
export const REPS_VALUES = Array.from({ length: REPS_MAX - REPS_MIN + 1 }, (_, i) => REPS_MIN + i);
