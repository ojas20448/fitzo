import { buildStarterPlan, readStarterPlan, starterSessionDraft } from '../starterWorkout';
import { defaultExercises } from '../../data/defaultExercises';
import { startingSplit } from '../onboardingPlan';
import { finalizeWorkout } from '../finalizeWorkout';
import { chooseWorkoutDraft, parseWorkoutIntent, previousWorkoutDraft } from '../workoutSetup';

test.each(['gym', 'dumbbells', 'bodyweight'] as const)('%s plans use available equipment for all day counts', equipment => {
    for (const days of [1, 2, 3, 4, 5, 6]) {
        const split = startingSplit(days, equipment);
        const plan = buildStarterPlan(split.days, { experience: 'new', equipment, session_minutes: 50 }, 25);
        expect(readStarterPlan(plan)).toEqual(plan);
        expect(plan.sessions.map(session => session.day_name)).toEqual(split.days);
        for (const session of plan.sessions) for (const item of session.exercises) {
            const exercise = defaultExercises.find(ex => ex.id === item.id)!;
            if (equipment !== 'gym') expect(['body weight', ...(equipment === 'dumbbells' ? ['dumbbell'] : [])]).toContain(exercise.equipment);
            // No home exercise silently depends on a bench or pull-up bar.
            if (equipment !== 'gym') expect(exercise.id).not.toMatch(/bench|pull_up|supported|incline/);
        }
    }
});
test('time limits exercise count and experience changes set count without inventing loads', () => {
    const short = buildStarterPlan(['Full Body A'], { experience: 'regular', equipment: 'gym', session_minutes: 20 }, 25);
    const longer = buildStarterPlan(['Full Body A'], { experience: 'regular', equipment: 'gym', session_minutes: 50 }, 25);
    expect(short.sessions[0].exercises).toHaveLength(3);
    expect(short.sessions[0].exercises[0].set_count).toBe(2);
    expect(longer.sessions[0].exercises).toHaveLength(5);
    expect(longer.sessions[0].exercises[0].set_count).toBe(3);
    expect(buildStarterPlan(['Full Body A'], { ...longer.preferences, experience: 'returning' }, 25).sessions[0].exercises[0].set_count).toBe(2);
    expect(buildStarterPlan(['Full Body A'], longer.preferences, 16).sessions[0].exercises[0].set_count).toBe(2);
    expect(starterSessionDraft(longer, 'Full Body A')![0].sets[0].weight_kg).toBe('');
});
test('bodyweight draft starts at zero external weight and no suggestion counts as completed', () => {
    const plan = buildStarterPlan(['Full Body A'], { experience: 'new', equipment: 'bodyweight', session_minutes: 35 });
    const draft = starterSessionDraft(plan, 'Full Body A')!;
    expect(draft.every(ex => ex.sets.every(set => set.completed === false && set.weight_kg === 0))).toBe(true);
    expect(finalizeWorkout(draft)).toEqual([]);
    expect(starterSessionDraft(plan, 'Push')).toBeNull();
    expect(readStarterPlan({ ...plan, sessions: [null] })).toBeNull();
    expect(readStarterPlan({ ...plan, sessions: [{ day_name: 'Full Body A', exercises: [{ id: 'made-up', set_count: 3, reps: 10 }] }] })).toBeNull();
});
test('90-minute plans survive validation and open as editable, unperformed suggestions', () => {
    const plan = buildStarterPlan(['Upper A'], { experience: 'returning', equipment: 'gym', session_minutes: 90 });
    expect(readStarterPlan(plan)).toEqual(plan);
    const draft = starterSessionDraft(plan, 'Upper A')!;
    expect(draft.length).toBeGreaterThan(0);
    expect(draft.every(exercise => exercise.sets.every(set => !set.completed))).toBe(true);
    expect(readStarterPlan({ ...plan, preferences: { ...plan.preferences, session_minutes: 120 } })).toBeNull();
});
test('prior performed work wins; inactive, mismatched and corrupt starting templates are ignored', () => {
    const plan = buildStarterPlan(['Upper A'], { experience: 'new', equipment: 'gym', session_minutes: 35 });
    const splits = [{ is_active: true, split_id: 'upper_lower', days: ['Upper A'], training_plan: plan }];
    const previous = previousWorkoutDraft(JSON.stringify([{ id: 'custom', name: 'My exercise', sets: [{ weight_kg: 25, reps: 8, completed: true }, { weight_kg: 90, reps: 12, completed: false }] }]))!;
    expect(previous[0].sets).toHaveLength(1);
    expect(previous[0].sets[0]).toMatchObject({ completed: false, weight_kg: 25, previous: '25kg x 8' });
    expect(chooseWorkoutDraft(previous, splits, 'Upper A', 'upper_lower')).toMatchObject({ source: 'previous', exercises: previous });
    expect(chooseWorkoutDraft(null, splits, 'Upper A', 'ppl')).toBeNull();
    expect(chooseWorkoutDraft(null, [{ ...splits[0], is_active: false }], 'Upper A')).toBeNull();
    expect(chooseWorkoutDraft(null, splits, 'Upper A', 'upper_lower')).toMatchObject({ source: 'starter' });
    expect(previousWorkoutDraft('bad json')).toBeNull();
    expect(parseWorkoutIntent('bad json')).toBeNull();
    expect(parseWorkoutIntent(JSON.stringify({ session_label: ' Lower B ', training_pattern: 'upper_lower' }))).toMatchObject({ session_label: 'Lower B' });
});
