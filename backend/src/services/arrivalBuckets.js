/**
 * Arrival Buckets
 *
 * Shared arrival-bucketing query used by both the busy-times endpoint
 * (backend/src/routes/gyms.js) and the quiet-hours cron
 * (backend/src/services/quietHours.js). Extracted so the two call sites
 * can't drift on the lookback window or the IST bucketing.
 *
 * Lives here rather than in utils/busyTimes.js because that file is pure
 * (no DB import) and its test suite (busy-times.test.js) depends on that
 * purity — pulling `query` in there would saddle a unit-tested pure
 * function with a database dependency.
 *
 * Bucketing is done in Asia/Kolkata — check-in dedupe already uses IST, and
 * bucketing in UTC would shift every bar by 5.5 hours.
 */

const { query } = require('../config/database');

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
           EXTRACT(DOW  FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS dow,
           EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
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
