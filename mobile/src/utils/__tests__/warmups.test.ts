import { getWarmUp, WARMUP_ROUTINES } from '../../data/warmups';

describe('getWarmUp', () => {
    it('matches push days', () => {
        expect(getWarmUp('push')).toBe(WARMUP_ROUTINES.PUSH);
        expect(getWarmUp('Chest & Triceps')).toBe(WARMUP_ROUTINES.PUSH);
        expect(getWarmUp('SHOULDERS')).toBe(WARMUP_ROUTINES.PUSH);
    });

    it('matches pull days', () => {
        expect(getWarmUp('pull')).toBe(WARMUP_ROUTINES.PULL);
        expect(getWarmUp('Back & Biceps')).toBe(WARMUP_ROUTINES.PULL);
        expect(getWarmUp('deadlift day')).toBe(WARMUP_ROUTINES.PULL);
    });

    it('matches leg days', () => {
        expect(getWarmUp('legs')).toBe(WARMUP_ROUTINES.LEGS);
        expect(getWarmUp('Quads and Glutes')).toBe(WARMUP_ROUTINES.LEGS);
        expect(getWarmUp('lower body')).toBe(WARMUP_ROUTINES.LEGS);
    });

    it('falls back to the general routine for anything else', () => {
        expect(getWarmUp('full body')).toBe(WARMUP_ROUTINES.GENERAL);
        expect(getWarmUp('cardio')).toBe(WARMUP_ROUTINES.GENERAL);
        expect(getWarmUp('my custom split')).toBe(WARMUP_ROUTINES.GENERAL);
    });

    it('falls back for null/undefined/empty rather than throwing', () => {
        expect(getWarmUp(null)).toBe(WARMUP_ROUTINES.GENERAL);
        expect(getWarmUp(undefined)).toBe(WARMUP_ROUTINES.GENERAL);
        expect(getWarmUp('')).toBe(WARMUP_ROUTINES.GENERAL);
    });

    it('checks push before pull so "chest and back" is not miscategorised twice', () => {
        // Order matters: the first matcher wins. Documenting the behaviour so a
        // reorder that changes it fails here.
        expect(getWarmUp('chest and back')).toBe(WARMUP_ROUTINES.PUSH);
    });
});

describe('routine content', () => {
    const all = Object.values(WARMUP_ROUTINES);

    it('every routine has a title and 4-6 moves', () => {
        all.forEach(routine => {
            expect(routine.title).toBeTruthy();
            expect(routine.moves.length).toBeGreaterThanOrEqual(4);
            expect(routine.moves.length).toBeLessThanOrEqual(6);
        });
    });

    it('every move has a name, a dose and a reason', () => {
        all.forEach(routine => {
            routine.moves.forEach(move => {
                expect(move.name).toBeTruthy();
                expect(move.dose).toBeTruthy();
                expect(move.why).toBeTruthy();
            });
        });
    });

    it('contains no loaded barbell/dumbbell work — warm-ups are mobility only', () => {
        const banned = /barbell|dumbbell|bench press|pull-?up|chin-?up|squat rack|deadlift \d/i;
        all.forEach(routine => {
            routine.moves.forEach(move => {
                expect(move.name).not.toMatch(banned);
            });
        });
    });
});
