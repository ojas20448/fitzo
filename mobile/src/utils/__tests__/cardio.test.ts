import { defaultExercises } from '../../data/defaultExercises';
import { cardioEntryError, isCardioExercise } from '../cardio';
import { finalizeWorkout } from '../finalizeWorkout';
import { buildShareExercises } from '../buildShareExercises';
import { exerciseHistoryFor } from '../exerciseHistory';
import { previousWorkoutDraft } from '../workoutSetup';
import { routineUpdate } from '../routineUpdate';
import { customSessionDraft } from '../savedWorkoutPlan';
import { customWorkoutPlan } from './fixtures/customWorkoutPlan';
import type { UserExercise } from '../../components/workout/types';

const treadmill: UserExercise = { id: 'running_treadmill', name: 'Treadmill Run', sets: [
    { id: 'one', duration_minutes: '20.5', rpe: '6', completed: true },
    { id: 'unfinished', duration_minutes: 10, completed: false },
] };

test('recognizes every local cardio exercise and remote metadata without changing strength exercises', () => {
    for (const exercise of defaultExercises) expect(isCardioExercise(exercise)).toBe(exercise.bodyPart === 'cardio');
    expect(isCardioExercise({ id: 'remote', name: 'Run', bodyPart: 'cardio' })).toBe(true);
    expect(isCardioExercise({ target: 'cardiovascular' })).toBe(true);
    expect(isCardioExercise({ name: 'Treadmill Walk' })).toBe(true);
    expect(isCardioExercise({ name: 'Dumbbell Row' })).toBe(false);
});

test.each(['', '0', '-5', '20min', 'Infinity', '1441'])('rejects invalid cardio duration %s', duration_minutes => {
    expect(cardioEntryError({ duration_minutes }, 'duration')).not.toBe('');
});
test.each(['0', '11', '6.5', 'hard'])('rejects invalid effort %s', rpe => {
    expect(cardioEntryError({ rpe }, 'effort')).not.toBe('');
});
test('accepts fractional minutes and optional effort while keeping cardio out of load volume', () => {
    expect(cardioEntryError({ duration_minutes: '0,5' }, 'duration')).toBe('');
    expect(cardioEntryError({ rpe: '' }, 'effort')).toBe('');
    const finished = finalizeWorkout([treadmill]);
    expect(finished[0].tracking_type).toBe('cardio');
    expect(finished[0].sets).toEqual([{ id: 'one', duration_minutes: 20.5, rpe: 6, completed: true }]);
    expect(buildShareExercises([treadmill])).toEqual([{ id: treadmill.id, name: treadmill.name, target: 'cardio', volumeKg: 0, setCount: 1, durationMinutes: 20.5 }]);
});

test('retains timed history and repeat values without carrying effort into the next session', () => {
    const exercises = finalizeWorkout([treadmill]);
    const groups = [{ logged_date: '2026-10-26', workouts: [{ id: 'w', exercises: JSON.stringify(exercises) }] }];
    expect(exerciseHistoryFor(groups, treadmill.name)[0].sets).toEqual([{ duration_minutes: 20.5, rpe: 6 }]);
    const repeated = previousWorkoutDraft(exercises)!;
    expect(repeated[0].sets[0]).toMatchObject({ duration_minutes: 20.5, rpe: '', completed: false });
});

test('saves and reloads cardio in a routine without requiring a reps prescription', () => {
    const draft = customSessionDraft(customWorkoutPlan, 'Upper 1')!;
    const result = routineUpdate(customWorkoutPlan, 'Upper 1', [...draft, treadmill]);
    expect(result.error).toBe('');
    const saved = result.plan!.sessions[0].exercises.at(-1)!;
    expect(saved).toMatchObject({ tracking_type: 'cardio', duration_minutes: 20.5 });
    expect(saved.reps_min).toBeUndefined();
    const resumed = customSessionDraft(result.plan, 'Upper 1')!.at(-1)!;
    expect(resumed.sets[0]).toMatchObject({ duration_minutes: 20.5, rpe: '', completed: false });
    expect(resumed.instructions).not.toContain('reps');
});
