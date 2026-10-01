import { ditherForExercise, DITHER_BY_MUSCLE } from '../ditherForExercise';

describe('ditherForExercise', () => {
    it('matches on the target muscle', () => {
        expect(ditherForExercise({ id: '1', name: 'Bench Press', target: 'chest', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.chest);
    });

    it('falls back to the exercise name when target is absent', () => {
        expect(ditherForExercise({ id: '1', name: 'Kettlebell Swing', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.kettlebell);
    });

    it('always returns something rather than a blank slot', () => {
        expect(ditherForExercise({ id: '1', name: 'Zzz', volumeKg: 0, setCount: 0 })).toBeTruthy();
    });

    it('is case insensitive', () => {
        expect(ditherForExercise({ id: '1', name: 'X', target: 'CHEST', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.chest);
    });
});
