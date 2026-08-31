import { CARD_LOCALE, formatVolumeKg, formatDate, formatTopSet, hasMuscleVolume, pickSummaryRows } from '../../components/share/format';
import type { SharePayload } from '../../components/share/SharePayload';

/** Minimal valid SharePayload — every optional field starts absent/empty so each test only sets what it needs. */
function basePayload(overrides: Partial<SharePayload> = {}): SharePayload {
    return {
        headline: '1,240 KG',
        rows: [],
        prs: [],
        exercises: [],
        date: new Date(2026, 7, 31),
        ...overrides,
    };
}

describe('CARD_LOCALE', () => {
    it('is pinned to en-IN — the product already speaks in Indian units (auto-rickshaws, Royal Enfields)', () => {
        expect(CARD_LOCALE).toBe('en-IN');
    });
});

describe('formatVolumeKg', () => {
    // RULING R18 regression coverage: a bare `.toLocaleString()` resolves the
    // VIEWER's device locale at runtime, so the same 123456 renders as
    // "123,456" on en-US, "1,23,456" on en-IN, or "123.456" on de-DE. These
    // hardcoded expectations pin ONE locale-specific grouping regardless of
    // whatever locale the machine running this test defaults to — if the
    // locale argument were ever dropped again, these fail the moment the
    // test runner's own default locale isn't coincidentally en-IN.
    it('groups a six-digit value with Indian digit grouping', () => {
        expect(formatVolumeKg(123456)).toBe('1,23,456');
    });

    it('groups a seven-digit value with Indian digit grouping', () => {
        expect(formatVolumeKg(1234567)).toBe('12,34,567');
    });

    it('needs no separator under 1000 — the range where the old bug was invisible', () => {
        expect(formatVolumeKg(920)).toBe('920');
    });

    it('rounds to the nearest whole kg before formatting', () => {
        expect(formatVolumeKg(919.6)).toBe('920');
        expect(formatVolumeKg(919.4)).toBe('919');
    });
});

describe('formatDate', () => {
    it('formats as DD MON YYYY', () => {
        expect(formatDate(new Date(2026, 7, 31))).toBe('31 AUG 2026');
    });

    it('pads a single-digit day', () => {
        expect(formatDate(new Date(2026, 0, 5))).toBe('05 JAN 2026');
    });

    it('is stable across two calls for the same date — nothing here is randomized or ambient', () => {
        const d = new Date(2026, 5, 1);
        expect(formatDate(d)).toBe(formatDate(d));
    });
});

describe('formatTopSet', () => {
    it('formats weight and reps together with a multiplication sign', () => {
        expect(formatTopSet({ weight_kg: 82.5, reps: 5 })).toBe('82.5×5');
    });

    it('rounds a float-noise weight to one decimal place (the R8 bug class)', () => {
        // Same shape of float tail as the "weight - improvement" bug ruling
        // R8 fixed elsewhere in this feature (60.3 - 0.2 style subtraction).
        expect(formatTopSet({ weight_kg: 60.29999999999998, reps: 3 })).toBe('60.3×3');
    });

    it('falls back to weight alone when reps is missing', () => {
        expect(formatTopSet({ weight_kg: 100 })).toBe('100 kg');
    });

    it('falls back to reps alone when weight is missing', () => {
        expect(formatTopSet({ reps: 8 })).toBe('8 reps');
    });

    it('returns null for a fully absent top set', () => {
        expect(formatTopSet(undefined)).toBeNull();
    });

    it('returns null when neither field is present', () => {
        expect(formatTopSet({})).toBeNull();
    });
});

describe('hasMuscleVolume', () => {
    // ANATOMY's degrade-gracefully rule: an all-untrained figure must never
    // render, because it looks like a bug rather than a design choice. This
    // predicate is the gate that decides that — see format.ts doc comment.
    it('is false for an undefined volume record', () => {
        expect(hasMuscleVolume(undefined)).toBe(false);
    });

    it('is false for an empty volume record', () => {
        expect(hasMuscleVolume({})).toBe(false);
    });

    it('is false when every entry is zero', () => {
        expect(hasMuscleVolume({ chest: 0, back: 0, legs: 0 })).toBe(false);
    });

    it('is false when every entry is negative (defensive — sets are never negative in practice)', () => {
        expect(hasMuscleVolume({ chest: -1 })).toBe(false);
    });

    it('is true when at least one entry is positive', () => {
        expect(hasMuscleVolume({ chest: 0, back: 3 })).toBe(true);
    });

    it('is true for a single positive entry', () => {
        expect(hasMuscleVolume({ legs: 6 })).toBe(true);
    });

    // Ruling R4 regression: AnatomyHeatmap's Vol type is Record<string,
    // number>, so a key it doesn't recognize is not a type error — it is
    // silently never read, and the figure renders all-untrained anyway. A
    // volume record populated only with such a key must NOT be treated as
    // "has data," or the degrade-gracefully guarantee is defeated.
    it('is false when the only positive entry is under a key AnatomyHeatmap does not read', () => {
        expect(hasMuscleVolume({ cardio: 5 })).toBe(false);
    });

    it('is true when a recognized key is positive alongside an unrecognized one', () => {
        expect(hasMuscleVolume({ cardio: 5, chest: 2 })).toBe(true);
    });

    it('recognizes the multi-word "lower back" key', () => {
        expect(hasMuscleVolume({ 'lower back': 1 })).toBe(true);
    });
});

describe('pickSummaryRows', () => {
    it('prefers PRs over everything else when present', () => {
        const payload = basePayload({
            prs: [{ exercise: 'Bench Press', current: '100 kg x 5', previous: '95 kg x 5' }],
            exercises: [{ id: 'e1', name: 'Squat', volumeKg: 500, setCount: 4 }],
            rows: [{ label: 'Sets', value: '12' }],
        });
        expect(pickSummaryRows(payload, 5)).toEqual([
            { label: 'Bench Press', value: '100 kg x 5' },
        ]);
    });

    it('falls back to exercises when there are no PRs, preferring topSet over volume', () => {
        const payload = basePayload({
            exercises: [
                { id: 'e1', name: 'Squat', volumeKg: 500, setCount: 4, topSet: { weight_kg: 100, reps: 5 } },
            ],
        });
        expect(pickSummaryRows(payload, 5)).toEqual([{ label: 'Squat', value: '100×5' }]);
    });

    it('falls back to formatted volume when an exercise has no topSet', () => {
        const payload = basePayload({
            exercises: [{ id: 'e1', name: 'Farmer Carry', volumeKg: 123456, setCount: 3 }],
        });
        expect(pickSummaryRows(payload, 5)).toEqual([{ label: 'Farmer Carry', value: '1,23,456 KG' }]);
    });

    it('falls back to rows when there are no PRs and no exercises', () => {
        const payload = basePayload({ rows: [{ label: 'Duration', value: '42 min' }] });
        expect(pickSummaryRows(payload, 5)).toEqual([{ label: 'Duration', value: '42 min' }]);
    });

    it('returns an empty array when prs, exercises, and rows are all empty — never throws, never fabricates a row', () => {
        expect(pickSummaryRows(basePayload(), 5)).toEqual([]);
    });

    it('caps the result at max', () => {
        const payload = basePayload({
            prs: [
                { exercise: 'A', current: '1' },
                { exercise: 'B', current: '2' },
                { exercise: 'C', current: '3' },
            ],
        });
        expect(pickSummaryRows(payload, 2)).toHaveLength(2);
    });

    it('clamps a negative max to zero instead of slicing from the end (Array.slice(0, -1) would otherwise return all-but-the-last row)', () => {
        // Needs >= 2 entries to actually discriminate: with a single-entry
        // array, ['A'].slice(0, -1) and ['A'].slice(0, 0) both happen to be
        // [], so a 1-entry fixture would pass whether or not the clamp
        // exists. With 2 entries, the clamped read is [] but the unclamped
        // (buggy) read would be [{label:'A', value:'1'}] — verified by
        // temporarily removing the clamp, see task-6-report.md fix log.
        const payload = basePayload({
            prs: [
                { exercise: 'A', current: '1' },
                { exercise: 'B', current: '2' },
            ],
        });
        expect(pickSummaryRows(payload, -1)).toEqual([]);
    });
});
