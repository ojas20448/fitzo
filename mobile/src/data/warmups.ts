/**
 * Dynamic warm-ups, chosen by what you're training that day.
 *
 * Deliberately mobility only — no loaded work, nothing that needs equipment,
 * nothing that could be mistaken for the first exercise of the session. These
 * cover the "raise" and "mobilise" phases: get blood moving and take the joints
 * you're about to load through their range.
 *
 * Dynamic on purpose. Long static holds before lifting transiently reduce force
 * output, so nothing here is a 60-second stretch — everything is swinging,
 * circling or flowing.
 *
 * Local rather than server-driven: it never changes per user, it must work
 * offline mid-session, and a network round-trip before a warm-up is absurd.
 */

export interface WarmUpMove {
    name: string;
    /** Short prescription — "30 seconds", "10 each side". */
    dose: string;
    /** One line on what it's actually for. */
    why: string;
}

export interface WarmUpRoutine {
    title: string;
    moves: WarmUpMove[];
}

const PUSH: WarmUpRoutine = {
    title: 'Shoulders & chest',
    moves: [
        { name: 'Arm swings', dose: '30 seconds', why: 'Gets blood into the shoulders' },
        { name: 'Arm circles', dose: '10 forward, 10 back', why: 'Opens the shoulder joint' },
        { name: 'Towel shoulder dislocates', dose: '10 slow reps', why: 'Range for overhead and bench' },
        { name: 'Scapular push-ups', dose: '10 reps', why: 'Wakes up the shoulder blades' },
        { name: 'Cat-cow', dose: '8 slow reps', why: 'Loosens the upper back' },
    ],
};

const PULL: WarmUpRoutine = {
    title: 'Back & biceps',
    moves: [
        { name: 'Arm swings (cross-body)', dose: '30 seconds', why: 'Raises heart rate, opens the chest' },
        { name: 'Cat-cow', dose: '8 slow reps', why: 'Segments the spine before loading it' },
        { name: 'Thoracic rotations', dose: '8 each side', why: 'Upper-back rotation for rows' },
        { name: 'Towel pull-aparts', dose: '15 reps', why: 'Switches on the rear delts' },
        { name: 'Bodyweight hip hinge', dose: '10 reps', why: 'Grooves the hinge before deadlifts' },
    ],
};

const LEGS: WarmUpRoutine = {
    title: 'Hips, knees & ankles',
    moves: [
        { name: 'Leg swings (front to back)', dose: '10 each leg', why: 'Loosens the hip flexors' },
        { name: 'Leg swings (side to side)', dose: '10 each leg', why: 'Opens the hips laterally' },
        { name: 'Hip circles', dose: '8 each direction', why: 'Full range through the hip' },
        { name: 'Bodyweight squats', dose: '15 reps', why: 'Grooves the pattern under no load' },
        { name: 'Ankle rocks', dose: '10 each side', why: 'Ankle range so you can hit depth' },
    ],
};

const GENERAL: WarmUpRoutine = {
    title: 'Full body',
    moves: [
        { name: 'March on the spot', dose: '45 seconds', why: 'Raises the heart rate' },
        { name: 'Arm swings', dose: '30 seconds', why: 'Opens the shoulders and chest' },
        { name: 'Hip circles', dose: '8 each direction', why: 'Loosens the hips' },
        { name: 'Bodyweight squats', dose: '12 reps', why: 'Warms the knees and hips' },
        { name: 'Torso twists', dose: '10 each side', why: 'Rotation through the mid-back' },
    ],
};

// Matched loosely on purpose: workout_type is free-ish text (split names, custom
// labels), so substring matching beats an exact map that silently falls through.
const MATCHERS: { pattern: RegExp; routine: WarmUpRoutine }[] = [
    { pattern: /push|chest|shoulder|tricep/i, routine: PUSH },
    { pattern: /pull|back|bicep|lat|row|deadlift/i, routine: PULL },
    { pattern: /leg|quad|hamstring|glute|calf|lower/i, routine: LEGS },
];

/**
 * Pick a routine for a workout type. Anything unrecognised — full body, cardio,
 * a custom split name — gets the general routine rather than nothing.
 */
export function getWarmUp(workoutType: string | null | undefined): WarmUpRoutine {
    if (!workoutType) return GENERAL;
    const match = MATCHERS.find(m => m.pattern.test(workoutType));
    return match ? match.routine : GENERAL;
}

export const WARMUP_ROUTINES = { PUSH, PULL, LEGS, GENERAL };
