import { routineUpdate } from '../routineUpdate';
import { buildStarterPlan, starterSessionDraft } from '../starterWorkout';
import { customWorkoutPlan } from './fixtures/customWorkoutPlan';
import { customSessionDraft } from '../savedWorkoutPlan';

test('only structural changes prompt for an update; entered weights/reps do not change targets', () => {
    const day = customWorkoutPlan.sessions[0].day_name;
    const draft = customSessionDraft(customWorkoutPlan, day)!;
    draft[0].sets[0].weight_kg = 99; draft[0].sets[0].reps = 3;
    expect(routineUpdate(customWorkoutPlan, day, draft).changed).toBe(false);
    draft[0].sets.push({ id: 'extra', weight_kg: 99, reps: 3, completed: true });
    const result = routineUpdate(customWorkoutPlan, day, draft);
    expect(result.changed).toBe(true); expect(result.plan?.sessions[0].exercises[0].reps_min).toBe(customWorkoutPlan.sessions[0].exercises[0].reps_min);
    expect(result.plan?.sessions[0].exercises[0].set_count).toBe(draft[0].sets.length);
    expect(result.plan?.sessions.slice(1)).toEqual(customWorkoutPlan.sessions.slice(1));
    expect(JSON.stringify(result.plan)).not.toContain('weight_kg');
});
test('converts a starting routine without changing the other training days and keeps exercise order', () => {
    const plan = buildStarterPlan(['Upper 1', 'Lower 1'], { experience: 'new', equipment: 'gym', session_minutes: 20 }, 25);
    const draft = starterSessionDraft(plan, 'Upper 1')!.reverse();
    const result = routineUpdate(plan, 'Upper 1', draft);
    expect(result.plan?.sessions[0].exercises.map(e => e.id)).toEqual(draft.map(e => e.id));
    expect(result.plan?.sessions[1].exercises.map(e => [e.id, e.set_count, e.reps_min])).toEqual(plan.sessions[1].exercises.map(e => [e.id, e.set_count, e.reps]));
});
test('requires a rep target for new exercises and preserves the source plan on invalid edits', () => {
    const plan = buildStarterPlan(['Upper 1'], { experience: 'new', equipment: 'gym', session_minutes: 20 }, 25);
    const draft = starterSessionDraft(plan, 'Upper 1')!;
    draft.push({ id: 'new', name: 'Cable Fly', sets: [{ id: 'n', completed: false }] });
    expect(routineUpdate(plan, 'Upper 1', draft)).toMatchObject({ changed: true, plan: null, error: expect.stringContaining('Enter reps for Cable Fly') });
    draft.at(-1)!.sets[0].reps = 12;
    expect(routineUpdate(plan, 'Upper 1', draft).plan?.sessions[0].exercises.at(-1)).toMatchObject({ name: 'Cable Fly', reps_min: 12, reps_max: 12 });
    expect(plan.sessions[0].exercises).toHaveLength(3);
});
