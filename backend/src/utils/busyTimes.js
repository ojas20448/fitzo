/**
 * Busy Times Derivation
 *
 * Turns raw check-in arrival counts (already bucketed by IST day-of-week and
 * hour by SQL) into a normalised 7x24 busyness grid.
 *
 * Scores are RELATIVE to the gym's own busiest hour (0-100), not to capacity.
 * "Busy for this gym" is the useful signal; absolute occupancy is a separate
 * concern handled by crowd.js.
 *
 * Privacy: below MIN_TOTAL_SAMPLES check-ins the grid is suppressed entirely —
 * a sparse grid can deanonymise individual members' gym habits.
 */

const DAYS = 7;
const HOURS = 24;

const MIN_TOTAL_SAMPLES = 20;   // below this: show nothing
const GOOD_CONFIDENCE_SAMPLES = 60; // at/above this: trust the shape

function emptyGrid() {
    return Array.from({ length: DAYS }, () => new Array(HOURS).fill(0));
}

function isValidRow(r) {
    if (!r) return false;
    const dow = Number(r.dow);
    const hour = Number(r.hour);
    const arrivals = Number(r.arrivals);
    return (
        Number.isInteger(dow) && dow >= 0 && dow < DAYS &&
        Number.isInteger(hour) && hour >= 0 && hour < HOURS &&
        Number.isFinite(arrivals) && arrivals > 0
    );
}

/**
 * @param {Array<{dow:number,hour:number,arrivals:number}>} rows
 * @returns {{grid:number[][]|null, peak:object|null, quietest:object|null,
 *            totalSamples:number, confidence:'none'|'low'|'good'}}
 */
function computeBusyTimes(rows) {
    const valid = (Array.isArray(rows) ? rows : []).filter(isValidRow);
    const totalSamples = valid.reduce((sum, r) => sum + Number(r.arrivals), 0);

    if (totalSamples < MIN_TOTAL_SAMPLES) {
        return { grid: null, peak: null, quietest: null, totalSamples, confidence: 'none' };
    }

    // Raw counts into the grid
    const counts = emptyGrid();
    valid.forEach((r) => {
        counts[Number(r.dow)][Number(r.hour)] += Number(r.arrivals);
    });

    // Normalise against the single busiest cell
    let max = 0;
    counts.forEach((day) => day.forEach((c) => { if (c > max) max = c; }));

    const grid = counts.map((day) => day.map((c) => (max > 0 ? Math.round((c / max) * 100) : 0)));

    // Peak + quietest are drawn from OBSERVED hours only. An hour with zero
    // check-ins usually means "gym shut", not "gym pleasantly empty" — calling
    // 3am the quietest hour would be true and useless.
    let peak = null;
    let quietest = null;
    valid.forEach((r) => {
        const dow = Number(r.dow);
        const hour = Number(r.hour);
        const score = grid[dow][hour];
        if (!peak || score > peak.score) peak = { dow, hour, score };
        if (!quietest || score < quietest.score) quietest = { dow, hour, score };
    });

    const confidence = totalSamples >= GOOD_CONFIDENCE_SAMPLES ? 'good' : 'low';

    return { grid, peak, quietest, totalSamples, confidence };
}

module.exports = {
    computeBusyTimes,
    MIN_TOTAL_SAMPLES,
    GOOD_CONFIDENCE_SAMPLES,
    DAYS,
    HOURS,
};
