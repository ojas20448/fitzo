/**
 * Cron Routes
 *
 * Endpoints triggered by external schedulers (GitHub Actions cron workflows).
 * Render's free tier has no built-in cron, so a scheduled workflow calls
 * these with a shared secret.
 *
 * Security: requires `x-cron-secret` header matching process.env.CRON_SECRET.
 * If CRON_SECRET is not configured, these endpoints are disabled (404).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { asyncHandler } = require('../utils/errors');
const quietHoursService = require('../services/quietHours');

// Constant-time secret comparison
function secretMatches(provided) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !provided) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.use((req, res, next) => {
    if (!process.env.CRON_SECRET) {
        return res.status(404).json({ error: true, message: "This endpoint doesn't exist", code: 'NOT_FOUND' });
    }
    if (!secretMatches(req.headers['x-cron-secret'])) {
        return res.status(401).json({ error: true, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
    next();
});

// Device-only AI consent cannot authorize server batches. Keep reports on demand
// until consent and revocation can be verified for each account on the server.
router.post(['/daily-insights', '/weekly-recaps'], (req, res) => {
    res.json({ success: true, skipped: true, message: 'Scheduled AI processing is disabled. Insights are available on demand in the app.' });
});

/**
 * POST /api/cron/quiet-alerts
 * Push "your gym is quiet now" to members whose gym is historically unbusy.
 */
router.post('/quiet-alerts', asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, message: 'Quiet-hours alerts batch started' });
    quietHoursService.runQuietAlerts()
        .then(({ sent, skipped }) => console.log(`Quiet alerts batch done: sent=${sent} skipped=${skipped}`))
        .catch(err => console.error('Quiet alerts batch failed:', err.message));
}));

module.exports = router;
