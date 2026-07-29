/**
 * Gym Routes
 *
 * Gym-scoped aggregate data. Everything here is derived from members'
 * check-in history, so every endpoint is guarded to the caller's own gym.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ForbiddenError, ValidationError } = require('../utils/errors');
const { computeBusyTimes } = require('../utils/busyTimes');
const { getArrivalBuckets } = require('../services/arrivalBuckets');
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
            const rows = await getArrivalBuckets(gymId);
            return computeBusyTimes(rows);
        },
        cache.TTL.BUSY_TIMES
    ).catch((err) => {
        console.error('Busy-times query error:', err.message);
        return computeBusyTimes([]);
    });

    res.json({ success: true, busy_times: busyTimes });
}));

module.exports = router;
