/**
 * Gym Routes
 *
 * Gym-scoped aggregate data. Everything here is derived from members'
 * check-in history, so every endpoint is guarded to the caller's own gym.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ForbiddenError, ValidationError } = require('../utils/errors');
const { computeBusyTimes } = require('../utils/busyTimes');
const cache = require('../services/cache');

// UUID v4 shape — reject junk before it reaches Postgres
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/gyms/:id/busy-times
 * 7x24 hour-of-week busyness grid from the last 8 weeks of check-ins.
 *
 * Bucketing is done in Asia/Kolkata — check-in dedupe already uses IST, and
 * bucketing in UTC would shift every bar by 5.5 hours.
 */
router.get('/:id/busy-times', authenticate, asyncHandler(async (req, res) => {
    const gymId = req.params.id;

    if (!UUID_RE.test(gymId)) {
        throw new ValidationError('That gym link looks wrong');
    }

    // Tenancy: aggregate habits of a gym you don't belong to are not yours to read.
    // ForbiddenError -> 403 (AuthError would wrongly signal 401 "log in again").
    if (!req.user.gym_id || req.user.gym_id !== gymId) {
        throw new ForbiddenError('You can only view your own gym');
    }

    const busyTimes = await cache.getOrSet(
        cache.keys.busyTimes(gymId),
        async () => {
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
            return computeBusyTimes(result.rows);
        },
        cache.TTL.BUSY_TIMES
    ).catch(() => computeBusyTimes([]));

    res.json({ success: true, busy_times: busyTimes });
}));

module.exports = router;
