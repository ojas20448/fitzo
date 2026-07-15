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
const dailyInsightService = require('../services/dailyInsight');
const weeklyRecapService = require('../services/weeklyRecap');

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

/**
 * POST /api/cron/daily-insights
 * Generate + push the morning coach insight for all active users.
 * Responds immediately; the batch runs in the background.
 */
router.post('/daily-insights', asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, message: 'Daily insights batch started' });
    dailyInsightService.generateAllDailyInsights()
        .catch(err => console.error('Daily insights batch failed:', err.message));
}));

/**
 * POST /api/cron/weekly-recaps
 * Generate last week's recap for all active users (run Mondays).
 */
router.post('/weekly-recaps', asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, message: 'Weekly recaps batch started' });
    weeklyRecapService.generateAllWeeklyRecaps()
        .catch(err => console.error('Weekly recaps batch failed:', err.message));
}));

module.exports = router;
