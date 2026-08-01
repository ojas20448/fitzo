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
    /** Entered per side — volume counts both. See backend/src/utils/volume.js */
    is_unilateral?: boolean;
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
// 2.5kg is the standard plate jump. At 0.5 the wheel held 601 items and 100kg
// sat 200 scroll-steps in, which made loading a normal working weight painful.
// At 2.5 it is 121 items and 40 steps. Off-grid values (e.g. an older 91kg
// entry, or anything typed by hand) are still accepted — the wheel snaps to the
// nearest item rather than resetting, and typed values are stored verbatim.
export const WEIGHT_STEP = 2.5;
export const REPS_MIN = 0;
export const REPS_MAX = 100;

// Pre-compute weight values once
export const WEIGHT_VALUES = Array.from(
    { length: (WEIGHT_MAX - WEIGHT_MIN) / WEIGHT_STEP + 1 },
    (_, i) => WEIGHT_MIN + i * WEIGHT_STEP,
);
export const REPS_VALUES = Array.from({ length: REPS_MAX - REPS_MIN + 1 }, (_, i) => REPS_MIN + i);
export const RIR_MIN = 0;
export const RIR_MAX = 5;
export const RIR_VALUES = Array.from({ length: RIR_MAX - RIR_MIN + 1 }, (_, i) => RIR_MIN + i);
