/**
 * Crowd Level Calculation
 *
 * Single source of truth for the green/yellow/red crowd light.
 * Occupancy = active members (checked in within last 60 min) / gym capacity.
 *
 *   green  (low)    occupancy <  40%
 *   yellow (medium) occupancy 40–74%
 *   red    (high)   occupancy >= 75%
 */

const DEFAULT_CAPACITY = 50;

const THRESHOLDS = {
    MEDIUM: 0.4,  // 40% of capacity → yellow
    HIGH: 0.75,   // 75% of capacity → red
};

/**
 * @param {number} activeCount - members checked in within the active window
 * @param {number|null} capacity - gym capacity (falls back to DEFAULT_CAPACITY)
 * @returns {{ level: 'low'|'medium'|'high', percentage: number, active_now: number, capacity: number }}
 */
function computeCrowd(activeCount, capacity) {
    const cap = Number.isFinite(Number(capacity)) && Number(capacity) > 0
        ? Number(capacity)
        : DEFAULT_CAPACITY;
    const active = Math.max(0, parseInt(activeCount, 10) || 0);

    const occupancy = active / cap;

    let level = 'low';
    if (occupancy >= THRESHOLDS.HIGH) {
        level = 'high';
    } else if (occupancy >= THRESHOLDS.MEDIUM) {
        level = 'medium';
    }

    return {
        level,
        percentage: Math.min(100, Math.round(occupancy * 100)),
        active_now: active,
        capacity: cap,
    };
}

module.exports = { computeCrowd, DEFAULT_CAPACITY, THRESHOLDS };
