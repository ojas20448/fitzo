// Named timezones handle travel and DST. India remains the legacy fallback.

const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The member's current date. */
const IST_TODAY_SQL = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** The day a row belongs to. Requires `created_at` to be in scope. */
const IST_DAY_OF_SQL = `(created_at AT TIME ZONE '${APP_TIMEZONE}')::date`;
// Personal queries bind the subject's id as $1, including trainer/buddy views.
const MEMBER_TIMEZONE_SQL = `COALESCE((SELECT timezone FROM users WHERE id = $1), '${APP_TIMEZONE}')`;
const MEMBER_TODAY_SQL = `(NOW() AT TIME ZONE ${MEMBER_TIMEZONE_SQL})::date`;
// A gym's calendar belongs to its physical location, independent of the viewer.
const GYM_TIMEZONE_SQL = `COALESCE((SELECT timezone FROM gyms WHERE id = $1), '${APP_TIMEZONE}')`;
const GYM_TODAY_SQL = `(NOW() AT TIME ZONE ${GYM_TIMEZONE_SQL})::date`;

function sessionDaySql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    // Legacy sessions were assigned India days; their original timezone is unknown.
    return `(${prefix}completed_at AT TIME ZONE COALESCE(${prefix}completed_timezone, '${APP_TIMEZONE}'))::date`;
}

function attendanceDaySql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return `(${prefix}checked_in_at AT TIME ZONE COALESCE(${prefix}checked_timezone, '${APP_TIMEZONE}'))::date`;
}

function measurementDaySql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return `(${prefix}recorded_at AT TIME ZONE COALESCE(${prefix}recorded_timezone, ${MEMBER_TIMEZONE_SQL}))::date`;
}

function memberDateString(at = new Date(), timezone = APP_TIMEZONE) {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function startOfWeek(date = new Date(), timezone = APP_TIMEZONE) {
    const day = new Date(`${memberDateString(date, timezone)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return day.toISOString().slice(0, 10);
}

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
    MEMBER_TIMEZONE_SQL,
    MEMBER_TODAY_SQL,
    GYM_TIMEZONE_SQL,
    GYM_TODAY_SQL,
    sessionDaySql,
    attendanceDaySql,
    measurementDaySql,
    memberDateString,
    startOfWeek,
    IST_TODAY_SQL,
    IST_DAY_OF_SQL,
    istDateString,
    isValidDateString,
};
