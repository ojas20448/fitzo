import { CARD_LOCALE, formatVolumeKg, formatDate, formatTopSet } from '../../components/share/format';

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
