/**
 * Volume Tests
 *
 * A unilateral set is entered PER SIDE, so both sides count. Getting this
 * backwards silently halves or doubles weekly volume, the anatomy heatmap,
 * and PR detection.
 */

const { setVolume, VOLUME_SQL, UNILATERAL_MULTIPLIER } = require('../utils/volume');

describe('setVolume', () => {
    it('is weight times reps for a bilateral set', () => {
        expect(setVolume(20, 10, false)).toBe(200);
    });

    it('doubles for a unilateral set at the same weight and reps', () => {
        expect(setVolume(20, 10, true)).toBe(400);
        expect(setVolume(20, 10, true)).toBe(setVolume(20, 10, false) * UNILATERAL_MULTIPLIER);
    });

    it('handles decimal weights — 2.5kg is the standard plate jump', () => {
        expect(setVolume(2.5, 8, false)).toBe(20);
        expect(setVolume(22.5, 6, true)).toBe(270);
    });

    it('returns 0 for zero reps or zero weight, never NaN', () => {
        expect(setVolume(20, 0, false)).toBe(0);
        expect(setVolume(0, 10, false)).toBe(0);
        expect(setVolume(0, 0, true)).toBe(0);
    });

    it('returns 0 for junk input instead of NaN', () => {
        expect(setVolume(null, 10, false)).toBe(0);
        expect(setVolume(undefined, undefined, false)).toBe(0);
        expect(setVolume('abc', 10, false)).toBe(0);
        expect(setVolume(-5, 10, false)).toBe(0);
    });

    it('accepts numeric strings — set values arrive as strings from the picker', () => {
        expect(setVolume('20', '10', false)).toBe(200);
        expect(setVolume('20', '10', true)).toBe(400);
    });

    it('treats any truthy unilateral flag consistently', () => {
        expect(setVolume(20, 10, undefined)).toBe(200);
        expect(setVolume(20, 10, null)).toBe(200);
    });
});

describe('VOLUME_SQL', () => {
    it('references the aliases its consumers use', () => {
        expect(VOLUME_SQL).toContain('sl.weight_kg');
        expect(VOLUME_SQL).toContain('sl.reps');
        expect(VOLUME_SQL).toContain('el.is_unilateral');
    });

    it('embeds the same multiplier the JS helper uses', () => {
        expect(VOLUME_SQL).toContain(String(UNILATERAL_MULTIPLIER));
    });
});
