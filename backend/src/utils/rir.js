/**
 * RIR (Reps In Reserve) parsing and validation.
 *
 * Scale is 0-5. RIR 0 = went to failure. null = not recorded. These are
 * DIFFERENT states and must never be collapsed into each other.
 */

const RIR_MIN = 0;
const RIR_MAX = 5;

/**
 * @param {*} value raw input from the client
 * @returns {{valid: boolean, rir: number|null, error: string|null}}
 */
function parseRir(value) {
    if (value === null || value === undefined || value === '') {
        return { valid: true, rir: null, error: null };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < RIR_MIN || n > RIR_MAX) {
        return {
            valid: false,
            rir: null,
            error: `RIR must be a whole number from ${RIR_MIN} to ${RIR_MAX}`,
        };
    }
    return { valid: true, rir: n, error: null };
}

module.exports = { parseRir, RIR_MIN, RIR_MAX };
