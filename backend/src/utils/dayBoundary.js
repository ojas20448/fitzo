/**
 * The Member's Day
 *
 * ONE definition of when a day starts and ends, because several places need
 * it and they currently disagree. The database runs in UTC, so a bare
 * CURRENT_DATE is wrong for 5.5 hours every night: a meal logged at 01:00 IST
 * would be filed under the previous day. Meanwhile checkin.js already uses
 * IST, so today the food log and the check-in streak disagree about the date.
 *
 * India does not observe DST, so a fixed +05:30 offset is correct and avoids
 * pulling in an Intl/tz dependency for the JS side.
 */

const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The member's current date. */
const IST_TODAY_SQL = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** The day a row belongs to. Requires `created_at` to be in scope. */
const IST_DAY_OF_SQL = `(created_at AT TIME ZONE '${APP_TIMEZONE}')::date`;

/**
 * @param {Date|string} [at] defaults to now
 * @returns {string|null} 'YYYY-MM-DD' in IST, or null if unparseable
 */
function istDateString(at = new Date()) {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Strict 'YYYY-MM-DD' check for a client-supplied date, including that the
 * date actually exists (rejects 2026-02-30). Anything reaching a query as a
 * date must pass this first.
 */
function isValidDateString(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10) === s;
}

module.exports = {
    APP_TIMEZONE,
    IST_TODAY_SQL,
    IST_DAY_OF_SQL,
    istDateString,
    isValidDateString,
};
