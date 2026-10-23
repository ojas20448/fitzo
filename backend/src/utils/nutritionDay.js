const { APP_TIMEZONE } = require('./dayBoundary');
const { ValidationError } = require('./errors');

// Nutrition queries bind their subject's user id as $1, including trainer views.
const MEMBER_TIMEZONE_SQL = `COALESCE((SELECT timezone FROM users WHERE id = $1), '${APP_TIMEZONE}')`;
const MEMBER_TODAY_SQL = `(NOW() AT TIME ZONE ${MEMBER_TIMEZONE_SQL})::date`;

function nutritionDaySql(alias = '', timezoneSql = MEMBER_TIMEZONE_SQL) {
    const prefix = alias ? `${alias}.` : '';
    // Correct India-assigned legacy dates; preserve explicit backdates and the
    // original local day of new meals, even after travel.
    return `(CASE WHEN ${prefix}logged_timezone IS NULL AND ${prefix}logged_date = (${prefix}created_at AT TIME ZONE '${APP_TIMEZONE}')::date THEN (${prefix}created_at AT TIME ZONE ${timezoneSql})::date ELSE ${prefix}logged_date END)`;
}

function normalizeTimezone(value) {
    if (typeof value === 'string' && value.length <= 100 && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(value)) {
        try { return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone; } catch {}
    }
    throw new ValidationError('Choose a valid named timezone');
}

module.exports = { MEMBER_TIMEZONE_SQL, MEMBER_TODAY_SQL, nutritionDaySql, normalizeTimezone };
