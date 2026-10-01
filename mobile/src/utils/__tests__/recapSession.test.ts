import { getRecapSession } from '../recapSession';
import type { LastSession } from '../../stores/lastSessionStore';
const saved: LastSession = { title: 'Push', durationMin: 42, setCount: 3, volumeKg: 500, completedAt: 1000,
    exercises: [{ id: 'bench', name: 'Bench', volumeKg: 500, setCount: 3 }], prs: [] };
it('keeps the finished workout details and timestamp', () => {
    expect(getRecapSession(JSON.stringify({ duration: 42, sets: 3, volume: 500, completedAt: 1000 }), '{}', saved)).toEqual(saved);
});
it('never substitutes another workout from the last-session store', () => {
    const result = getRecapSession(JSON.stringify({ duration: 20, sets: 2, volume: 150, completedAt: 2000 }), JSON.stringify({ name: 'Pull' }), saved);
    expect(result).toMatchObject({ title: 'Pull', durationMin: 20, setCount: 2, volumeKg: 150, completedAt: 2000, exercises: [] });
});
it('handles malformed recap routes without crashing or fabricating a workout', () => {
    expect(getRecapSession('{broken', '{}', saved)).toBeNull();
    expect(getRecapSession('{}', '{}', null)).toBeNull();
});
it('does not identify an older workout from matching totals alone', () => {
    expect(getRecapSession(JSON.stringify({ duration: 42, sets: 3, volume: 500 }), JSON.stringify({ name: 'Pull' }), saved)).toBeNull();
});
