import { CARD_LOCALE, formatVolumeKg, formatDate, formatTopSet, hasMuscleVolume, pickSummaryRows, fitFontSize, estimateTextWidthEm, HERO_CHAR_WIDTH_RATIO } from '../../components/share/format';
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

describe('fitFontSize', () => {
    // Regression coverage for the review finding: Scoreboard's hero had
    // numberOfLines={1} + adjustsFontSizeToFit already, but a rendered
    // react-native-web measurement showed the LITERAL fontSize (320) being
    // used unshrunk — "12,480 KG" measured scrollWidth 1654 against an
    // 800px box, clipped to "12,...". fitFontSize exists to guarantee a
    // fit by arithmetic, independent of whether that RN prop does anything
    // on a given platform — these tests are the only real coverage this
    // repo can provide for the fix, since the component tree itself still
    // cannot be rendered here.

    it('returns maxFontSize when the string already fits at full size', () => {
        // 1 char at ratio 0.5 needs width 0.5*fontSize; way under maxWidth 200 even at fontSize 100.
        expect(fitFontSize('A', 200, 100, 20, 0.5)).toBe(100);
    });

    it('shrinks proportionally when the literal size would overflow maxWidth', () => {
        // 10 chars at ratio 0.5 need width 5*fontSize; solving 5*fontSize = 300 -> fontSize = 60 exactly.
        expect(fitFontSize('AAAAAAAAAA', 300, 200, 20, 0.5)).toBe(60);
    });

    it('clamps to minFontSize for a pathologically long string rather than continuing to shrink', () => {
        const longText = 'A'.repeat(200);
        expect(fitFontSize(longText, 300, 200, 40, 0.5)).toBe(40);
    });

    it('is monotonically non-increasing as the string gets longer, all else equal', () => {
        const shortFit = fitFontSize('AB', 400, 200, 20, 0.5);
        const longFit = fitFontSize('ABCDEFGH', 400, 200, 20, 0.5);
        expect(longFit).toBeLessThanOrEqual(shortFit);
    });

    it('never returns less than minFontSize even for an empty string', () => {
        expect(fitFontSize('', 300, 200, 40, 0.5)).toBeGreaterThanOrEqual(40);
    });

    it('closes the loop on the real review measurement: the fitted size fits maxWidth even judged by the ACTUAL measured ratio, not the padded one', () => {
        const text = '12,480 KG';
        // The real ratio the review harness's measurement implies, independent of HERO_CHAR_WIDTH_RATIO's padding.
        const measuredRatio = 1654 / 320 / text.length;
        const fitted = fitFontSize(text, 860, 320, 100, HERO_CHAR_WIDTH_RATIO);
        expect(fitted).toBeLessThan(320); // must actually shrink from the literal size that measured as overflowing
        expect(fitted * measuredRatio * text.length).toBeLessThanOrEqual(860);
    });

    it('HERO_CHAR_WIDTH_RATIO is padded above the real measured ratio (~0.574), not equal to or below it', () => {
        const measuredRatio = 1654 / 320 / '12,480 KG'.length;
        expect(HERO_CHAR_WIDTH_RATIO).toBeGreaterThan(measuredRatio);
    });
});

/**
 * RULING R31 regression suite.
 *
 * A single average character-width ratio (0.62) was calibrated on the
 * DIGIT-heavy headline "12,480 KG" and under-estimated the LETTER-heavy Stats
 * weekly headline "4 WORKOUTS", which truncated in three themes at once.
 * Measured in a real react-native-web render:
 *   Spec       156px    needed 1097px, box 936px
 *   Scoreboard 138.71px needed  974px, box 860px
 *   Anatomy    140px    needed  983px, box 936px
 * Back-solving each gives ~0.702, against the 0.62 assumed.
 */
describe('estimateTextWidthEm — per-character width model (R31)', () => {
    // The two strings with real measured widths, expressed in em.
    // measuredEm = measuredPx / fontSizePx.
    const MEASURED = [
        { text: '12,480 KG', em: 1654 / 320 },   // 5.169
        { text: '4 WORKOUTS', em: 974 / 138.71 }, // 7.022
    ];

    it.each(MEASURED)('never under-estimates the real measured width of "$text"', ({ text, em }) => {
        // Erring HIGH is safe (slightly smaller font). Erring low is the bug.
        expect(estimateTextWidthEm(text)).toBeGreaterThanOrEqual(em);
    });

    it('does not wildly over-estimate either — within 25% of measured', () => {
        for (const { text, em } of MEASURED) {
            expect(estimateTextWidthEm(text)).toBeLessThan(em * 1.25);
        }
    });

    it('rates a letter-heavy string wider than a digit-heavy one of equal length', () => {
        // This is the whole defect in one assertion: the old uniform ratio
        // rated these two identically, because it only counted characters.
        expect(estimateTextWidthEm('WORKOUTSXX')).toBeGreaterThan(estimateTextWidthEm('1234567890'));
    });

    it('rates an all-wide-caps worst case far above any uniform-ratio estimate', () => {
        // A single ratio of even 0.72 would say 7.2em for this. It is not enough.
        expect(estimateTextWidthEm('WWWWWWWWWW')).toBeGreaterThan(10 * 0.72);
    });
});

describe('fitFontSize fits real theme headline boxes (R31)', () => {
    // The actual box widths the themes pass, read from their source.
    const BOXES = [
        { theme: 'Spec', box: 936, max: 156, min: 80 },
        { theme: 'Scoreboard', box: 860, max: 320, min: 100 },
        { theme: 'Anatomy', box: 936, max: 140, min: 72 },
    ];
    // Every headline the app can actually produce today.
    const HEADLINES = ['12,480 KG', '4 WORKOUTS', '1,23,456 KG', '8 WORKOUTS'];

    it.each(BOXES)('$theme: every real headline fits its $box px box', ({ box, max, min }) => {
        for (const text of HEADLINES) {
            const size = fitFontSize(text, box, max, min);
            const widthPx = estimateTextWidthEm(text) * size;
            // Only the min-clamp may legitimately exceed the box; none of
            // these headlines should be anywhere near that floor.
            expect(size).toBeGreaterThan(min);
            expect(widthPx).toBeLessThanOrEqual(box + 0.5);
        }
    });

    it('does NOT needlessly shrink a digit headline versus the old uniform ratio', () => {
        // Guards against over-correcting. "12,480 KG" already fit before R31,
        // so the per-character model must not size it SMALLER than the old
        // uniform 0.62 did. (320 here is the max, not the expected result —
        // a 9-character headline never reaches it in an 860px box.)
        const underOldRatio = fitFontSize('12,480 KG', 860, 320, 100, HERO_CHAR_WIDTH_RATIO);
        const underNewModel = fitFontSize('12,480 KG', 860, 320, 100);
        expect(underNewModel).toBeGreaterThanOrEqual(underOldRatio);
    });

    it('DOES shrink the letter-heavy headline that used to overflow', () => {
        // The defect, inverted into an assertion: under the old ratio
        // "4 WORKOUTS" was sized too large for Spec's 936px box and truncated.
        const underOldRatio = fitFontSize('4 WORKOUTS', 936, 156, 80, HERO_CHAR_WIDTH_RATIO);
        const underNewModel = fitFontSize('4 WORKOUTS', 936, 156, 80);
        expect(underNewModel).toBeLessThan(underOldRatio);
        expect(estimateTextWidthEm('4 WORKOUTS') * underNewModel).toBeLessThanOrEqual(936.5);
    });

    it('an explicit ratio still uses the old uniform arithmetic', () => {
        // The escape hatch for a caller with a real measured ratio, and what
        // the arithmetic-shape tests above rely on.
        expect(fitFontSize('AAAAAAAAAA', 300, 200, 20, 0.5)).toBe(60);
    });
});
