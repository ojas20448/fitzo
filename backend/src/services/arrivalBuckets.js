/**
 * Arrival Buckets
 *
 * Shared arrival-bucketing query used by both the busy-times endpoint
 * (backend/src/routes/gyms.js) and the quiet-hours cron
 * (backend/src/services/quietHours.js). Extracted so the two call sites
 * can't drift on the lookback window or the gym's local time.
 *
 * Lives here rather than in utils/busyTimes.js because that file is pure
 * (no DB import) and its test suite (busy-times.test.js) depends on that
 * purity — pulling `query` in there would saddle a unit-tested pure
 * function with a database dependency.
 *
 * Buckets follow the physical gym's timezone, including DST changes.
 */

const { query } = require('../config/database');
const { GYM_TIMEZONE_SQL } = require('../utils/dayBoundary');

/**
 * @param {string} gymId
 * @returns {Promise<Array<{dow:number, hour:number, arrivals:number}>>}
 *   `arrivals` is cast to ::int in SQL — uncast, COUNT(*) is int8 and
 *   node-pg returns int8 as a string, which would break the arithmetic in
 *   computeBusyTimes.
 */
async function getArrivalBuckets(gymId) {
    const result = await query(
        `SELECT
           EXTRACT(DOW  FROM checked_in_at AT TIME ZONE ${GYM_TIMEZONE_SQL})::int AS dow,
           EXTRACT(HOUR FROM checked_in_at AT TIME ZONE ${GYM_TIMEZONE_SQL})::int AS hour,
           COUNT(*)::int AS arrivals
         FROM attendances
         WHERE gym_id = $1
           AND checked_in_at > NOW() - INTERVAL '8 weeks'
         GROUP BY 1, 2`,
        [gymId]
    );
    return result.rows;
}

module.exports = { getArrivalBuckets };
