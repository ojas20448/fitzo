import { pickMoment, getWorkoutMilestone, getVolumeMilestone } from '../shareMoment';

const base = {
    completedAt: Date.now(), title: 'Push', durationMin: 58,
    volumeKg: 12400, setCount: 24, prs: [],
    exercises: [
        { id: 'a', name: 'Bench Press', volumeKg: 3200, setCount: 4 },
        { id: 'b', name: 'Overhead Press', volumeKg: 5100, setCount: 3 },
    ],
};

describe('pickMoment — open on the interesting thing', () => {
    it('prefers a PR over everything else', () => {
        const m = pickMoment({ ...base, prs: [{ exercise: 'Bench Press', current: '80 kg x 5' }] });
        expect(m.selection).toEqual(['pr:Bench Press']);
        expect(m.theme).toBe('scoreboard');
    });

    it('falls back to the heaviest exercise by volume, not the first', () => {
        const m = pickMoment(base);
        expect(m.selection).toEqual(['ex:b']);
        expect(m.theme).toBe('receipt');
    });

    it('falls back to session total when nothing stands out', () => {
        const m = pickMoment({ ...base, exercises: [] });
        expect(m.selection).toEqual(['total']);
        expect(m.theme).toBe('receipt');
    });

    it('picks only the first PR, so SCOREBOARD gets one number', () => {
        const m = pickMoment({ ...base, prs: [
            { exercise: 'Bench Press', current: '80 kg x 5' },
            { exercise: 'Squat', current: '120 kg x 3' },
        ]});
        expect(m.selection).toHaveLength(1);
    });
});

describe('milestones', () => {
    it('names round workout counts', () => {
        expect(getWorkoutMilestone(100)).toBe('100TH WORKOUT');
        expect(getWorkoutMilestone(50)).toBe('50TH WORKOUT');
    });

    it('is silent on unremarkable counts', () => {
        expect(getWorkoutMilestone(63)).toBeNull();
    });

    it('fires a volume milestone only near the crossing', () => {
        expect(getVolumeMilestone(101_000)).toBe('100K KG LIFETIME');
        expect(getVolumeMilestone(180_000)).toBeNull();
    });

    it('uses locale-independent labels', () => {
        expect(getVolumeMilestone(1_005_000)).toBe('1M KG LIFETIME');
    });
});
