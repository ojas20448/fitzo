import { exerciseMediaCandidates, withExerciseMedia } from '../exerciseMedia';
jest.mock('../../data/exerciseStaticPhotos', () => ({ exerciseStaticPhotos: { chest_press_machine: 'file:///Machine_Bench_Press/0.jpg' } }));

test('recovers exact-name photos for API and cached exercises without media', () => {
    const exercise = { id: '0001', name: '3/4 sit-up', target: 'abs' };
    expect(exerciseMediaCandidates(exercise)[0]).toMatchObject({ kind: 'photo', uri: expect.stringContaining('3_4_Sit-Up/0.jpg') });
    expect(withExerciseMedia(exercise)).toMatchObject({ ...exercise, gifUrl: expect.stringContaining('3_4_Sit-Up/0.jpg') });
});
test('keeps supplied media and provides the existing photo as a fallback', () => {
    const media = exerciseMediaCandidates({ name: 'Air Bike', gifUrl: 'https://example.test/air-bike.gif' });
    expect(media[0]).toMatchObject({ kind: 'animation', uri: 'https://example.test/air-bike.gif' });
    expect(media.some(item => item.uri.includes('Air_Bike/0.jpg'))).toBe(true);
});
test('does not guess an unrelated exercise for a custom or unmatched name', () => {
    expect(exerciseMediaCandidates({ name: 'Unknown chest exercise' })).toEqual([]);
    expect(exerciseMediaCandidates({ name: 'Air Bike', custom: true })).toEqual([]);
    expect(exerciseMediaCandidates({ name: 'assisted chest dip (kneeling)' })).toEqual([]);
});
test('recovers a saved local exercise by stable ID without changing its workout instructions', () => {
    const exercise = { id: 'chest_press_machine', name: 'Chest Press', instructions: '2 working sets' };
    expect(withExerciseMedia(exercise)).toMatchObject({ instructions: '2 working sets', gifUrl: expect.stringContaining('Machine_Bench_Press') });
});
test('a stored photo has its original file as a fallback even when the catalog name differs', () => {
    const media = exerciseMediaCandidates({ id: 'chest_press_machine', name: 'Chest Press' });
    expect(media.some(item => item.uri.startsWith('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Bench_Press/0.jpg'))).toBe(true);
});
test('a bundled photo loads ahead of a remote photo and remains a fallback for a supplied GIF', () => {
    const photo = exerciseMediaCandidates({ id: 'chest_press_machine', name: 'Chest Press', gifUrl: 'https://example.test/photo.jpg' });
    expect(photo[0].uri).toBe('file:///Machine_Bench_Press/0.jpg');
    const animation = exerciseMediaCandidates({ id: 'chest_press_machine', name: 'Chest Press', gifUrl: 'https://example.test/demo.gif' });
    expect(animation[0].kind).toBe('animation');
    expect(animation[1].uri).toBe('file:///Machine_Bench_Press/0.jpg');
});
