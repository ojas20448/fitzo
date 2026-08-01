/**
 * RIR Tests
 *
 * Reps In Reserve, 0-5. RIR 0 means "went to failure"; null means "not
 * recorded". Collapsing those two would mark every unrecorded set as a
 * failure set, which would wreck any intensity analysis built on it.
 */

const { parseRir, RIR_MIN, RIR_MAX } = require('../utils/rir');

describe('parseRir', () => {
    it('accepts every value in range', () => {
        for (let v = RIR_MIN; v <= RIR_MAX; v++) {
            expect(parseRir(v)).toMatchObject({ valid: true, rir: v });
        }
    });

    it('keeps 0 distinct from not-recorded', () => {
        expect(parseRir(0)).toMatchObject({ valid: true, rir: 0 });
        expect(parseRir(null)).toMatchObject({ valid: true, rir: null });
        expect(parseRir(undefined)).toMatchObject({ valid: true, rir: null });
        expect(parseRir('')).toMatchObject({ valid: true, rir: null });
    });

    it('accepts numeric strings — the picker yields strings', () => {
        expect(parseRir('3')).toMatchObject({ valid: true, rir: 3 });
    });

    it('rejects values outside the scale', () => {
        expect(parseRir(-1).valid).toBe(false);
        expect(parseRir(6).valid).toBe(false);
        expect(parseRir(10).valid).toBe(false);
    });

    it('rejects non-integers and junk', () => {
        expect(parseRir(2.5).valid).toBe(false);
        expect(parseRir('abc').valid).toBe(false);
        expect(parseRir({}).valid).toBe(false);
    });

    it('names the field in its error so the client can show it', () => {
        expect(parseRir(9).error).toMatch(/RIR/i);
    });
});
