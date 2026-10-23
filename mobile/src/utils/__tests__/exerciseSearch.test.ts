import { exerciseMatches, mergeExerciseResults, canonicalBodyPart, isExerciseSelected } from '../exerciseSearch';
const exercise = { id: 'row', name: 'Seated Cable Row', target: 'upper back', bodyPart: 'back' };
test('search matches words across exercise and muscle names', () => {
    expect(exerciseMatches(exercise, 'seated back')).toBe(true);
    expect(exerciseMatches(exercise, 'upper row')).toBe(true);
    expect(exerciseMatches(exercise, 'chest row')).toBe(false);
});
test('keeps muscle restrictions when filtering remote results and recognises API aliases', () => {
    expect(exerciseMatches({ ...exercise, bodyPart: 'upper arms' }, '', 'arms', ['arms'])).toBe(true);
    expect(exerciseMatches(exercise, 'row', null, ['arms'])).toBe(false);
    expect(exerciseMatches(exercise, '', 'back', ['arms'])).toBe(false);
    expect(canonicalBodyPart('lower legs')).toBe('legs');
    expect(canonicalBodyPart('waist')).toBe('core');
});
test('merges duplicate identities and names without replacing a stable local ID', () => {
    const merged = mergeExerciseResults([exercise], [{ ...exercise, id: 'provider-row', gifUrl: 'row.gif' }, { id: 'press', name: 'Chest Press' }]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: 'row', gifUrl: 'row.gif' });
});
test('deduplicates the starting catalog as well as later pages and recognises an already selected alias', () => {
    expect(mergeExerciseResults([exercise, { ...exercise, bodyPart: 'arms' }], [])).toHaveLength(1);
    expect(isExerciseSelected({ ...exercise, id: 'api-row' }, [exercise])).toBe(true);
    expect(isExerciseSelected({ id: 'press', name: 'Chest Press' }, [exercise])).toBe(false);
});
