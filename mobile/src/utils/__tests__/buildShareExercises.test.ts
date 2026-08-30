import { buildShareExercises } from '../buildShareExercises';
import type { UserExercise, ExerciseSet } from '../../components/workout';

let nextSetId = 0;
const set = (partial: Partial<ExerciseSet>): ExerciseSet => ({
    id: `s${nextSetId++}`,
    completed: true,
    ...partial,
});

const exercise = (id: string, sets: ExerciseSet[], isUnilateral = false): UserExercise => ({
    id,
    name: `Exercise ${id}`,
    is_unilateral: isUnilateral,
    sets,
});

describe('buildShareExercises', () => {
    // Regression for the bug caught in Task 2 review: per-exercise volumeKg
    // was Math.round()-ed independently of the session-level total, so
    // "sum of rounded parts" could diverge from "round of the sum" once the
    // user's chosen subset of exercises landed on a .5 boundary.
    it('keeps volumeKg raw so rounding the sum once matches the session total, not the sum of independently rounded parts', () => {
        const result = buildShareExercises([
            exercise('a', [set({ weight_kg: 45, reps: 3 })]),    // 45 * 3   = 135.0
            exercise('b', [set({ weight_kg: 16.5, reps: 5 })]),  // 16.5 * 5 = 82.5
            exercise('c', [set({ weight_kg: 17.5, reps: 5 })]),  // 17.5 * 5 = 87.5
        ]);

        // volumeKg must be the raw, unrounded value.
        expect(result.map((e) => e.volumeKg)).toEqual([135, 82.5, 87.5]);

        const roundOfSum = Math.round(result.reduce((sum, e) => sum + e.volumeKg, 0));
        const sumOfRoundedParts = result.reduce((sum, e) => sum + Math.round(e.volumeKg), 0);

        expect(roundOfSum).toBe(305);
        expect(sumOfRoundedParts).toBe(306); // the bug this test guards against
        expect(roundOfSum).not.toBe(sumOfRoundedParts);
    });

    // RULING R10: counted by w > 0 && r > 0, not by s.completed.
    it('excludes a set with weight but no reps', () => {
        const [ex] = buildShareExercises([
            exercise('a', [
                set({ weight_kg: 100, reps: undefined }),
                set({ weight_kg: 50, reps: 5 }),
            ]),
        ]);
        expect(ex.setCount).toBe(1);
        expect(ex.volumeKg).toBe(250); // only the second set (50 * 5) counts
    });

    it('counts a set with weight and reps even when marked incomplete', () => {
        const [ex] = buildShareExercises([
            exercise('a', [set({ weight_kg: 50, reps: 5, completed: false })]),
        ]);
        expect(ex.setCount).toBe(1);
        expect(ex.volumeKg).toBe(250);
    });

    // RULING R11: parseFloat(String(x || 0)) guards against undefined, empty,
    // and non-numeric weight/reps. None of these may throw or yield NaN.
    it('never throws and never yields NaN for undefined, empty, or non-numeric weight/reps', () => {
        const build = () => buildShareExercises([
            exercise('a', [
                set({ weight_kg: undefined, reps: undefined }),
                set({ weight_kg: '', reps: '' }),
                set({ weight_kg: 'abc', reps: 'xyz' }),
                set({ weight_kg: 50, reps: 5 }),
            ]),
        ]);

        expect(build).not.toThrow();

        const [ex] = build();
        expect(Number.isNaN(ex.volumeKg)).toBe(false);
        expect(ex.setCount).toBe(1);
        expect(ex.topSet).toEqual({ weight_kg: 50, reps: 5 });
    });

    it('drops an exercise entirely when none of its sets are valid, without throwing', () => {
        const build = () => buildShareExercises([
            exercise('a', [
                set({ weight_kg: undefined, reps: undefined }),
                set({ weight_kg: '', reps: '' }),
            ]),
        ]);

        expect(build).not.toThrow();
        expect(build()).toEqual([]);
    });
});
