/**
 * Crowd Level Calculation
 *
 * Single source of truth for the green/yellow/red crowd light.
 * Occupancy = active members (checked in and still inside their session
 * window — explicit checkout, or DEFAULT_SESSION_MINUTES after check-in if
 * they never checked out) / gym capacity.
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

/**
 * Median gym session. Used to auto-expire a check-in when the member never
 * checked out — which is the common case, since checkout is optional.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STATUS: this constant is the reference value; the two functions below are
 * NOT called from production code.
 *
 * The occupancy rule actually runs as SQL, in three places that each repeat
 * the 90-minute literal by hand because Postgres cannot cleanly parameterise
 * an INTERVAL:
 *   - src/routes/member.js   (member crowd light)
 *   - src/routes/manager.js  (manager dashboard)
 *   - src/db/schema.sql      get_crowd_level()  [no JS caller]
 *
 * presenceWindowEnd/isPresent below are the same rule expressed in JS, kept
 * because they are unit-tested and therefore serve as the executable
 * specification those three SQL sites are checked against. They are NOT dead
 * code to be deleted on sight — but they are also not load-bearing, so do not
 * assume changing them changes behaviour. Change the SQL too.
 *
 * Contrast src/utils/volume.js, which solves this better: it exports the rule
 * as a SQL fragment string that every query interpolates, so there is exactly
 * one definition. Migrating this rule to that pattern is worthwhile but was
 * out of scope when the checkout feature landed.
 * ─────────────────────────────────────────────────────────────────────────
 */
const DEFAULT_SESSION_MINUTES = 90;

/**
 * When does this member stop counting as present?
 * Explicit checkout wins; otherwise assume a standard session length.
 */
function presenceWindowEnd(checkedInAt, checkedOutAt, sessionMinutes = DEFAULT_SESSION_MINUTES) {
    if (checkedOutAt) {
        const checkoutDate = new Date(checkedOutAt);
        if (!Number.isNaN(checkoutDate.getTime())) {
            return checkoutDate;
        }
    }
    return new Date(new Date(checkedInAt).getTime() + sessionMinutes * 60 * 1000);
}

/**
 * Is this attendance row inside the gym right now?
 * Present == check-in has happened AND the session window has not closed.
 */
function isPresent(row, now = new Date(), sessionMinutes = DEFAULT_SESSION_MINUTES) {
    if (!row || !row.checked_in_at) return false;
    const start = new Date(row.checked_in_at);
    if (Number.isNaN(start.getTime())) return false;
    const end = presenceWindowEnd(start, row.checked_out_at, sessionMinutes);
    const t = new Date(now).getTime();
    return start.getTime() <= t && t < end.getTime();
}

module.exports = {
    computeCrowd,
    presenceWindowEnd,
    isPresent,
    DEFAULT_CAPACITY,
    DEFAULT_SESSION_MINUTES,
    THRESHOLDS,
};
