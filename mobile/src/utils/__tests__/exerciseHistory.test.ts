import { exerciseHistoryFor, latestExerciseSession } from '../exerciseHistory';
const group = (exercises: unknown, date = '2026-10-21') => ({ logged_date: date, workouts: [{ id: date, completed: true, workout_type: 'chest', exercises }] });
test('keeps actual pairs, completed bodyweight sets and RIR zero while rejecting invalid or unchecked data', () => {
    const history = exerciseHistoryFor([group(JSON.stringify([{ name: 'Push Up', sets: [
        { weight_kg: 10, reps: 5 }, { weight_kg: 0, reps: 20, rir: 0 },
        { weight_kg: 100, reps: 50, completed: false }, { weight_kg: '', reps: 8 }, { weight_kg: 20, reps: 8.5 },
    ] }]))], ' push up ');
    expect(history[0].sets).toEqual([{ weight_kg: 10, reps: 5 }, { weight_kg: 0, reps: 20, rir: 0 }]);
});
test('matches exact names and tolerates old, malformed and incomplete logs', () => {
    expect(exerciseHistoryFor([group('Bench, Row'), group([{ name: 'Upper Chest Press', sets: [{ weight_kg: 40, reps: 8 }] }]), group([{ name: 'Chest Press', sets: [] }])], 'Chest Press')).toEqual([]);
});
test('sorts sessions by day and precise timestamps, retaining per-side mode', () => {
    const g = group([{ name: 'Row', is_unilateral: true, sets: [{ weight_kg: 20, reps: 10 }] }]);
    g.workouts[0] = { ...g.workouts[0], created_at: '2026-10-21T11:00:00Z' } as any;
    g.workouts.push({ ...g.workouts[0], id: 'later', created_at: '2026-10-21T12:00:00Z' } as any);
    const sessions = exerciseHistoryFor([g, group([{ name: 'Row', sets: [{ weight_kg: 30, reps: 5 }] }], '2026-10-20')], 'Row');
    expect(latestExerciseSession(sessions)?.id).toBe('later-0'); expect(sessions[0].isUnilateral).toBe(true);
});
test('does not guess the last workout if an older server returns multiple unordered workouts on a day', () => {
    const g = group([{ name: 'Row', sets: [{ weight_kg: 20, reps: 10 }] }]); g.workouts.push({ ...g.workouts[0], id: 'other' });
    expect(latestExerciseSession(exerciseHistoryFor([g], 'Row'))).toBeUndefined();
});
