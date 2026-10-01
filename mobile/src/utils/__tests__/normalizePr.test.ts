import { normalizePr, normalizePrs } from '../normalizePr';

describe('normalizePr — two backend shapes, one output', () => {
    it('reads the Smart Log shape (workouts.js)', () => {
        expect(normalizePr({ name: 'Bench Press', current: '80 kg x 5', previous: '75 kg x 5' }))
            .toEqual({ exercise: 'Bench Press', current: '80 kg x 5', previous: '75 kg x 5' });
    });

    it('reads the live-session shape (workout-sessions.js)', () => {
        expect(normalizePr({ exerciseName: 'Squat', newWeight: 100, improvement: 5 }))
            .toEqual({ exercise: 'Squat', current: '100 kg', previous: '95 kg' });
    });

    it('omits previous when improvement is missing', () => {
        expect(normalizePr({ exerciseName: 'Deadlift', newWeight: 140 }))
            .toEqual({ exercise: 'Deadlift', current: '140 kg' });
    });

    it('rounds decimal weights to avoid floating-point tail', () => {
        expect(normalizePr({ exerciseName: 'Squat', newWeight: 60.3, improvement: 0.2 }))
            .toEqual({ exercise: 'Squat', current: '60.3 kg', previous: '60.1 kg' });
    });

    it('returns null rather than a card that says "PR"', () => {
        expect(normalizePr({})).toBeNull();
        expect(normalizePr(null)).toBeNull();
        expect(normalizePr({ current: '80 kg x 5' })).toBeNull();
    });

    it('drops unusable entries from a list instead of failing the whole share', () => {
        const out = normalizePrs([
            { name: 'Bench Press', current: '80 kg x 5' },
            {},
            { exerciseName: 'Squat', newWeight: 100 },
        ]);
        expect(out).toHaveLength(2);
        expect(out.map(p => p.exercise)).toEqual(['Bench Press', 'Squat']);
    });

    it('tolerates a non-array', () => {
        expect(normalizePrs(undefined as never)).toEqual([]);
    });
});
