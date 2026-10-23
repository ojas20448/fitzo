export const customWorkoutPlan = {
    version: 2 as const,
    type: 'custom' as const,
    schedule: ['Upper 1', 'Lower 1', 'Rest', 'Upper 2', 'Lower 2 + accessories', 'Rest', 'Rest'],
    tempo: '3-1-1-0',
    tempo_description: '3 seconds lowering, 1-second stretch pause, 1 second lifting, no pause at the top.',
    rep_range: { min: 7, max: 10 },
    weekly_working_sets: 52,
    working_sets_per_exercise: 2,
    warmups_additional: true,
    unilateral_sets: '2 working sets per side',
    sessions: [
        { day_name: 'Upper 1', names: ['Chest press', 'Upper chest fly', 'Mid delt fly', 'Unilateral sagittal pull', 'Lying cable lateral raise', 'Incline triceps pushdown', 'Cable curl'] },
        { day_name: 'Lower 1', names: ['Hamstring curls', 'Sissy squat', 'Bulgarian split squat', 'Seated hamstring curl', 'Calf raise', 'Cable crunch'] },
        { day_name: 'Upper 2', names: ['Lat row', 'Unilateral pulldown', 'Unilateral low row', 'Reverse fly', 'Cable Y-raise', 'Incline curl'] },
        { day_name: 'Lower 2 + accessories', names: ['Quad extension', 'Hamstring curl', 'Deficit Romanian deadlift', 'Glute raise', 'Dumbbell stretch fly', 'Cable front raise', 'Overhead triceps extension'] },
    ].map(({ day_name, names }) => ({ day_name, exercises: names.map((name, order_index) => ({
        name, order_index, set_count: 2, reps_min: 7, reps_max: 10, tempo: '3-1-1-0',
        is_unilateral: /Unilateral|Bulgarian/.test(name),
    })) })),
};
