import { buildSharePayload, deriveMuscleVolume } from '../buildSharePayload';
import { TOTAL_ID, EX_PREFIX, PR_PREFIX, MUSCLES_ID } from '../shareMoment';
import type { LastSession } from '../../stores/lastSessionStore';
import type { ShareExercise } from '../../components/share/SharePayload';

const exercise = (overrides: Partial<ShareExercise> & { id: string }): ShareExercise => ({
    name: `Exercise ${overrides.id}`,
    volumeKg: 0,
    setCount: 1,
    ...overrides,
});

const baseSession = (overrides: Partial<LastSession> = {}): LastSession => ({
    completedAt: new Date(2026, 7, 31, 9, 30).getTime(),
    title: 'Push',
    durationMin: 58,
    volumeKg: 305,
    setCount: 3,
    exercises: [],
    prs: [],
    ...overrides,
});

describe('buildSharePayload — R12: round once, over exactly the selected exercises', () => {
    it('rounds the SUM of raw volumeKg once, not the sum of independently-rounded parts', () => {
        // Same trio buildShareExercises.test.ts guards: summed raw -> 305,
        // but rounding 135.0 / 82.5 / 87.5 independently first sums to 306 —
        // a card whose rows visibly contradict its own headline.
        const session = baseSession({
            exercises: [
                exercise({ id: 'a', volumeKg: 135.0 }),
                exercise({ id: 'b', volumeKg: 82.5 }),
                exercise({ id: 'c', volumeKg: 87.5 }),
            ],
        });

        const payload = buildSharePayload(session, ['ex:a', 'ex:b', 'ex:c']);

        expect(payload.headline).toBe('305 KG');
        expect(payload.headline).not.toBe('306 KG'); // the bug this test guards against
    });

    it('sums only the SELECTED subset, not every exercise in the session', () => {
        const session = baseSession({
            exercises: [
                exercise({ id: 'a', volumeKg: 135.0 }),
                exercise({ id: 'b', volumeKg: 82.5 }),
                exercise({ id: 'c', volumeKg: 87.5 }),
            ],
        });

        const payload = buildSharePayload(session, ['ex:a']);

        expect(payload.headline).toBe('135 KG');
        expect(payload.exercises).toHaveLength(1);
        expect(payload.exercises[0].id).toBe('a');
    });
});

describe('buildSharePayload — selection semantics', () => {
    it('"total" includes every exercise in the session', () => {
        const session = baseSession({
            exercises: [
                exercise({ id: 'a', volumeKg: 100 }),
                exercise({ id: 'b', volumeKg: 200 }),
            ],
        });

        const payload = buildSharePayload(session, ['total']);

        expect(payload.headline).toBe('300 KG');
        expect(payload.exercises).toHaveLength(2);
    });

    it('falls back to the session-level volumeKg when "total" is selected but no exercise qualified', () => {
        // pickMoment's own third branch: prs and exercises can both be empty
        // (e.g. an all-warm-up session), and 'total' is still the selection.
        const session = baseSession({ volumeKg: 0, exercises: [], prs: [] });

        const payload = buildSharePayload(session, ['total']);

        expect(payload.headline).toBe('0 KG');
        expect(payload.exercises).toEqual([]);
    });

    it("a PR-only selection headlines the PR's own current value, unmodified", () => {
        const session = baseSession({
            exercises: [exercise({ id: 'a', volumeKg: 999 })],
            prs: [{ exercise: 'Bench Press', current: '82.5 kg x 3', previous: '80 kg x 3' }],
        });

        const payload = buildSharePayload(session, ['pr:Bench Press']);

        expect(payload.headline).toBe('82.5 kg x 3');
        expect(payload.prs).toEqual([{ exercise: 'Bench Press', current: '82.5 kg x 3', previous: '80 kg x 3' }]);
        expect(payload.exercises).toEqual([]); // the PR's exercise was not itself selected
    });

    it('falls back to the session total when the only chip selected carries no volume or PR content (e.g. "muscles" alone)', () => {
        const session = baseSession({ volumeKg: 12345, exercises: [exercise({ id: 'a', volumeKg: 500 })] });

        const payload = buildSharePayload(session, ['muscles']);

        expect(payload.headline).toBe('12,345 KG');
        expect(payload.exercises).toEqual([]);
    });

    it('prefers the exercise total over a simultaneously-selected PR', () => {
        const session = baseSession({
            exercises: [exercise({ id: 'a', volumeKg: 500 })],
            prs: [{ exercise: 'Bench Press', current: '82.5 kg x 3' }],
        });

        const payload = buildSharePayload(session, ['total', 'pr:Bench Press']);

        expect(payload.headline).toBe('500 KG');
        expect(payload.prs).toHaveLength(1); // the PR is still carried, just not headlined
    });
});

describe("buildSharePayload — rows never empty (Receipt's BREAKDOWN block)", () => {
    it('always includes Duration and Sets, regardless of what is selected', () => {
        const session = baseSession({ durationMin: 42, setCount: 9, exercises: [], prs: [] });

        const payload = buildSharePayload(session, ['total']);

        expect(payload.rows.length).toBeGreaterThan(0);
        expect(payload.rows).toContainEqual({ label: 'Duration', value: '42 min' });
        expect(payload.rows).toContainEqual({ label: 'Sets', value: '9' });
    });

    it('adds a Streak row only when the session carries one', () => {
        const withStreak = buildSharePayload(baseSession({ streak: 5 }), ['total']);
        const withoutStreak = buildSharePayload(baseSession({ streak: undefined }), ['total']);

        expect(withStreak.rows).toContainEqual({ label: 'Streak', value: '5 days' });
        expect(withoutStreak.rows.some((r) => r.label === 'Streak')).toBe(false);
    });
});

describe('buildSharePayload — caption', () => {
    it('sets a weight-equivalence caption when the selection carries volume', () => {
        const session = baseSession({ exercises: [exercise({ id: 'a', volumeKg: 700 })] });
        const payload = buildSharePayload(session, ['ex:a']);
        expect(payload.caption).toBeTruthy();
    });

    it('leaves caption unset for a PR-only selection with zero selected volume', () => {
        const session = baseSession({
            exercises: [exercise({ id: 'a', volumeKg: 999 })],
            prs: [{ exercise: 'Squat', current: '120 kg x 1' }],
        });
        const payload = buildSharePayload(session, ['pr:Squat']);
        expect(payload.caption).toBeUndefined();
    });
});

describe('buildSharePayload — subtitle and date', () => {
    it('carries the session title and completion date', () => {
        const session = baseSession({ title: 'Pull', completedAt: new Date(2026, 0, 15).getTime() });
        const payload = buildSharePayload(session, ['total']);
        expect(payload.subtitle).toContain('Pull');
        expect(payload.date.getTime()).toBe(session.completedAt);
    });
});

describe('deriveMuscleVolume — R3/R4: lowercase keys, summed setCount, whole-session', () => {
    it('lowercases mixed-case DB target values into the keys AnatomyHeatmap reads', () => {
        const result = deriveMuscleVolume([
            exercise({ id: 'a', target: 'Chest', setCount: 4 }),
            exercise({ id: 'b', target: 'quads', setCount: 3 }),
        ]);
        expect(result).toEqual({ chest: 4, quads: 3 });
    });

    it('sums setCount across multiple exercises hitting the same muscle, rather than overwriting', () => {
        const result = deriveMuscleVolume([
            exercise({ id: 'a', target: 'Chest', setCount: 4 }),
            exercise({ id: 'b', target: 'chest', setCount: 3 }),
        ]);
        expect(result).toEqual({ chest: 7 });
    });

    it('skips an exercise with no target instead of throwing or emitting an "undefined" key', () => {
        const result = deriveMuscleVolume([
            exercise({ id: 'a', target: undefined, setCount: 5 }),
        ]);
        expect(result).toEqual({});
    });

    it('is independent of selection — every exercise in the session counts, not just the ones featured on the card', () => {
        // This is the whole reason it is a separate function from
        // buildSharePayload rather than reusing its selection filtering.
        const exercises = [
            exercise({ id: 'a', target: 'chest', setCount: 4 }),
            exercise({ id: 'b', target: 'back', setCount: 3 }),
        ];
        expect(deriveMuscleVolume(exercises)).toEqual({ chest: 4, back: 3 });
    });
});

describe('buildSharePayload — parses the shareMoment.ts id constants it imports, not a local copy', () => {
    // These ids are built from TOTAL_ID/EX_PREFIX/PR_PREFIX/MUSCLES_ID
    // (imported from '../shareMoment', the same module ShareComposerScreen
    // generates chip ids from) rather than hand-typed literals like 'ex:a'.
    // The point isn't just "these strings work" — the tests above already
    // cover that — it's that buildSharePayload's parsing is provably wired
    // to the SAME exported bindings the rest of the feature uses, so a
    // change to any one constant's value can't silently desync chip
    // generation from payload derivation without also breaking this file's
    // own assertions.
    it('TOTAL_ID selects every exercise in the session', () => {
        const session = baseSession({
            exercises: [
                exercise({ id: 'a', volumeKg: 100 }),
                exercise({ id: 'b', volumeKg: 200 }),
            ],
        });

        const payload = buildSharePayload(session, [TOTAL_ID]);

        expect(payload.headline).toBe('300 KG');
        expect(payload.exercises).toHaveLength(2);
    });

    it('EX_PREFIX + an exercise id selects exactly that exercise', () => {
        const session = baseSession({
            exercises: [
                exercise({ id: 'a', volumeKg: 135 }),
                exercise({ id: 'b', volumeKg: 200 }),
            ],
        });

        const payload = buildSharePayload(session, [`${EX_PREFIX}a`]);

        expect(payload.exercises).toHaveLength(1);
        expect(payload.exercises[0].id).toBe('a');
        expect(payload.headline).toBe('135 KG');
    });

    it('PR_PREFIX + an exercise name selects exactly that PR', () => {
        const session = baseSession({
            prs: [
                { exercise: 'Bench Press', current: '82.5 kg x 3', previous: '80 kg x 3' },
                { exercise: 'Squat', current: '120 kg x 1' },
            ],
        });

        const payload = buildSharePayload(session, [`${PR_PREFIX}Bench Press`]);

        expect(payload.prs).toEqual([{ exercise: 'Bench Press', current: '82.5 kg x 3', previous: '80 kg x 3' }]);
        expect(payload.headline).toBe('82.5 kg x 3');
    });

    it('MUSCLES_ID alone carries no volume/PR content, so the headline falls back to the session total', () => {
        const session = baseSession({ volumeKg: 12345, exercises: [exercise({ id: 'a', volumeKg: 500 })] });

        const payload = buildSharePayload(session, [MUSCLES_ID]);

        expect(payload.headline).toBe('12,345 KG');
        expect(payload.exercises).toEqual([]);
    });

    it('mixes cleanly in one selection array, same as the hand-typed-literal case', () => {
        const session = baseSession({
            exercises: [exercise({ id: 'a', volumeKg: 100 }), exercise({ id: 'b', volumeKg: 200 })],
            prs: [{ exercise: 'Bench Press', current: '82.5 kg x 3' }],
        });

        const payload = buildSharePayload(session, [`${EX_PREFIX}a`, `${PR_PREFIX}Bench Press`, MUSCLES_ID]);

        expect(payload.exercises.map((e) => e.id)).toEqual(['a']);
        expect(payload.prs).toHaveLength(1);
        expect(payload.headline).toBe('100 KG'); // exercise content still wins headline precedence
    });
});
