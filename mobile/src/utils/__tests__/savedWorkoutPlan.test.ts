import { chooseWorkoutDraft, previousWorkoutDraft } from '../workoutSetup';
import { finalizeWorkout } from '../finalizeWorkout';
import { customWorkoutPlan } from './fixtures/customWorkoutPlan';

const split = { is_active: true, split_id: 'custom', days: customWorkoutPlan.schedule, training_plan: customWorkoutPlan };

test.each(customWorkoutPlan.sessions)('loads every exercise in $day_name with the saved prescription', session => {
    const chosen = chooseWorkoutDraft(null, [split], session.day_name, 'custom');
    expect(chosen?.exercises.map(ex => ex.name)).toEqual(session.exercises.map(ex => ex.name));
    expect(chosen?.source).toBe('template');
    const exercises = chosen!.exercises;
    expect(new Set(exercises.map(ex => ex.id)).size).toBe(exercises.length);
    expect(exercises.every(ex => ex.sets.length === 2 && ex.sets.every(set => set.completed === false && set.weight_kg === '' && set.reps === ''))).toBe(true);
    expect(exercises[0].instructions).toContain('7–10 reps');
    expect(exercises[0].instructions).toContain('3-1-1-0');
    expect(finalizeWorkout(exercises)).toEqual([]);
});

test('saved template changes take precedence over old exercises and set counts', () => {
    const previous = previousWorkoutDraft([
        { id: 'old', name: 'Old exercise', sets: [{ weight_kg: 90, reps: 12 }] },
        { id: 'press', name: 'Chest press', sets: [{ weight_kg: 60, reps: 8 }, { weight_kg: 65, reps: 7 }, { weight_kg: 70, reps: 6 }] },
    ]);
    const chosen = chooseWorkoutDraft(previous, [split], 'Upper 1', 'custom')!;
    expect(chosen.source).toBe('template');
    expect(chosen.exercises.map(ex => ex.name)).not.toContain('Old exercise');
    expect(chosen.exercises[0].sets).toHaveLength(2);
    expect(chosen.exercises[0].sets[0]).toMatchObject({ weight_kg: 60, previous: '60kg x 8', completed: false });
    expect(finalizeWorkout(chosen.exercises)).toEqual([]);
});

test('template uses case-insensitive day matching but never an inactive or different split', () => {
    expect(chooseWorkoutDraft(null, [split], ' upper 1 ', 'custom')?.exercises).toHaveLength(7);
    expect(chooseWorkoutDraft(null, [{ ...split, is_active: false }], 'Upper 1', 'custom')).toBeNull();
    expect(chooseWorkoutDraft(null, [split], 'Upper 1', 'ppl')).toBeNull();
    expect(chooseWorkoutDraft(null, [split], 'Rest', 'custom')).toBeNull();
});

test.each([
    { ...customWorkoutPlan, sessions: [null] },
    { ...customWorkoutPlan, sessions: [{ day_name: 'Upper 1', exercises: [{ name: 'Chest press', set_count: 100000, reps_min: 7, reps_max: 10 }] }] },
    { ...customWorkoutPlan, sessions: [{ day_name: 'Upper 1', exercises: [{ name: 'Chest press', set_count: 2, reps_min: 12, reps_max: 7 }] }] },
    { ...customWorkoutPlan, sessions: [{ day_name: 'Upper 1', exercises: [{ name: '', set_count: 2, reps_min: 7, reps_max: 10 }] }] },
])('corrupt templates do not create workout rows', training_plan => {
    expect(chooseWorkoutDraft(null, [{ ...split, training_plan }], 'Upper 1', 'custom')).toBeNull();
});

test('schedule-only splits still reuse the last performed workout', () => {
    const previous = previousWorkoutDraft([{ id: 'own', name: 'My exercise', sets: [{ weight_kg: 20, reps: 8 }] }])!;
    expect(chooseWorkoutDraft(previous, [{ ...split, training_plan: null }], 'Upper 1')).toEqual({ source: 'previous', exercises: previous });
});
