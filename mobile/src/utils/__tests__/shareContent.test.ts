import { buildSharePayload, deriveMuscleVolume } from '../buildSharePayload';
import { pickMoment } from '../shareMoment';
import { formatTopSet, formatVolumeKg, hasMuscleVolume } from '../../components/share/format';
import { defaultExercises } from '../../data/defaultExercises';
import Receipt from '../../components/share/themes/Receipt';
import Spec from '../../components/share/themes/Spec';
import Anatomy from '../../components/share/themes/Anatomy';
import type { LastSession } from '../../stores/lastSessionStore';

// Inspect content returned by the real themes; native geometry is checked separately.
function content(node: any): string {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(content).join('|');
    return content(node.props?.children);
}
const session: LastSession = {
    completedAt: new Date(2026, 8, 13).getTime(), title: 'Push', durationMin: 52, volumeKg: 4000, setCount: 10, prs: [],
    exercises: [
        { id: 'a', name: 'Barbell Bench Press', target: 'pectorals', volumeKg: 2400, setCount: 4 },
        { id: 'b', name: 'Overhead Press', target: 'delts', volumeKg: 1600, setCount: 6 },
    ],
};

it('opens a no-PR workout on its whole-session total', () => {
    const payload = buildSharePayload(session, pickMoment(session).selection);
    expect(payload.headline).toBe('4,000 KG');
});

it('identifies an individual lift and scopes its set count', () => {
    const payload = buildSharePayload(session, ['ex:a']);
    expect(content(Receipt({ payload }))).toContain('Barbell Bench Press');
    expect(payload.rows).toContainEqual({ label: 'Selected sets', value: '4' });
    expect(payload.rows).toContainEqual({ label: 'Session duration', value: '52 min' });
});

it('shows every selected PR in Spec, including names and previous values', () => {
    const payload = buildSharePayload({ ...session, prs: [
        { exercise: 'Bench', current: '82.5 kg x 8', previous: '80 kg x 8' },
        { exercise: 'Overhead Press', current: '42.5 kg x 8' },
    ] }, ['pr:Bench', 'pr:Overhead Press']);
    const rendered = content(Spec({ payload }));
    for (const value of ['Bench', '82.5 kg x 8', '80 kg x 8', 'Overhead Press', '42.5 kg x 8']) expect(rendered).toContain(value);
});

it('keeps weekly stat rows when changing to Spec', () => {
    const payload = { headline: '4 WORKOUTS', date: new Date(), exercises: [], prs: [], rows: [{ label: 'Protein', value: '120 g' }, { label: 'Streak', value: '5 days' }] };
    const rendered = content(Spec({ payload }));
    for (const value of ['Protein', '120 g', 'Streak', '5 days']) expect(rendered).toContain(value);
});

it('keeps selected records visible alongside the Anatomy map', () => {
    const payload = { ...buildSharePayload({ ...session, prs: [
        { exercise: 'Bench', current: '82.5 kg x 8' },
        { exercise: 'Overhead Press', current: '42.5 kg x 8' },
        { exercise: 'Third lift', current: '25 kg x 12' },
    ] }, ['pr:Bench', 'pr:Overhead Press', 'pr:Third lift']), muscleVolume: { chest: 4 } };
    const rendered = content(Anatomy({ payload }));
    for (const value of ['Bench', '82.5 kg x 8', 'Overhead Press', '42.5 kg x 8', '+1 more highlights']) expect(rendered).toContain(value);
});

it('maps the real bench, shoulder and row catalog targets into the heatmap', () => {
    const names = ['bench_press_barbell', 'overhead_press_barbell'];
    const exercises = names.map(id => ({ ...defaultExercises.find(ex => ex.id === id)!, volumeKg: 100, setCount: 4 }));
    const mapped = deriveMuscleVolume([...exercises, { id: 'row', name: 'Row', target: ' Upper Back ', volumeKg: 100, setCount: 3 }]);
    expect(mapped).toEqual({ chest: 4, shoulders: 4, back: 3 });
    expect(hasMuscleVolume(mapped)).toBe(true);
});

it('does not turn cardio or unknown targets into an anatomical muscle', () => {
    expect(deriveMuscleVolume([{ id: 'x', name: 'Run', target: 'cardiovascular', volumeKg: 0, setCount: 1 }])).toEqual({});
});

it('keeps fractional volumes readable without a contradictory rounded breakdown', () => {
    expect([135, 82.5, 87.5].map(formatVolumeKg)).toEqual(['135', '82.5', '87.5']);
    expect(formatVolumeKg(305)).toBe('305');
});

it('celebrates completed bodyweight sets instead of headlining zero kg', () => {
    const payload = buildSharePayload({ ...session, volumeKg: 0, setCount: 3, exercises: [
        { id: 'p', name: 'Push Up', volumeKg: 0, setCount: 3, topSet: { weight_kg: 0, reps: 15 } },
    ] }, ['total']);
    expect(payload.headline).toBe('3 SETS');
    expect(formatTopSet(payload.exercises[0].topSet)).toBe('15 reps');
});
