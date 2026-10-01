/**
 * Health Data API
 *
 * Stores and retrieves wearable/health data synced from HealthKit (iOS)
 * and Health Connect (Android).
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { invalidateContextPack } = require('../services/contextPack');
const { z } = require('zod');
const { isValidDateString, istDateString } = require('../utils/dayBoundary');

const syncHealthSchema = z.object({
    steps: z.number().int().min(0).max(999999).nullable().optional(),
    active_calories: z.number().min(0).max(99999).nullable().optional(),
    resting_heart_rate: z.number().min(20).max(250).nullable().optional(),
    sleep_hours: z.number().min(0).max(24).nullable().optional(),
    date: z.string().refine(isValidDateString, 'Date must be a valid YYYY-MM-DD date').optional(),
}).refine(v => [v.steps, v.active_calories, v.resting_heart_rate, v.sleep_hours].some(n => n != null), 'No health measurements supplied');

router.use(authenticate);

// ===========================================
// POST /api/health/sync
// Upsert today's health data from wearable
// ===========================================
router.post('/sync', validate({ body: syncHealthSchema }), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        steps = null,
        active_calories = null,
        resting_heart_rate = null,
        sleep_hours = null,
        date,
    } = req.body;

    const targetDate = date || istDateString();

    const result = await query(
        `INSERT INTO health_data (user_id, date, steps, active_calories, resting_heart_rate, sleep_hours, source, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'wearable', NOW())
         ON CONFLICT (user_id, date)
         DO UPDATE SET
            steps = COALESCE(EXCLUDED.steps, health_data.steps),
            active_calories = COALESCE(EXCLUDED.active_calories, health_data.active_calories),
            resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, health_data.resting_heart_rate),
            sleep_hours = COALESCE(EXCLUDED.sleep_hours, health_data.sleep_hours),
            synced_at = NOW()
         RETURNING *`,
        [userId, targetDate, steps, active_calories, resting_heart_rate, sleep_hours]
    );

    // Invalidate context pack cache for fresh AI responses
    invalidateContextPack(userId).catch(() => {});

    res.json({ success: true, health: result.rows[0] });
}));

// ===========================================
// GET /api/health/today
// Get today's health summary
// ===========================================
router.get('/today', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const date = req.query.date || istDateString();
    if (!isValidDateString(date)) throw new ValidationError('Invalid date');

    const result = await query(
        `SELECT * FROM health_data WHERE user_id = $1 AND date = $2::date`,
        [userId, date]
    );

    res.json({
        health: result.rows[0] || {
            steps: null,
            active_calories: null,
            resting_heart_rate: null,
            sleep_hours: null,
        }
    });
}));

// ===========================================
// GET /api/health/history
// Get health data history (default 30 days)
// ===========================================
router.get('/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 30));
    const date = req.query.date || istDateString();
    if (!isValidDateString(date)) throw new ValidationError('Invalid date');

    const result = await query(
        `SELECT date, steps, active_calories, resting_heart_rate, sleep_hours
         FROM health_data
         WHERE user_id = $1 AND date BETWEEN $3::date - ($2::int - 1) AND $3::date
         ORDER BY date DESC`,
        [userId, days, date]
    );

    // Weekly averages
    const weeklyResult = await query(
        `SELECT
            date_trunc('week', date)::date as week_start,
            ROUND(AVG(steps)) as avg_steps,
            ROUND(AVG(active_calories)) as avg_active_calories,
            ROUND(AVG(resting_heart_rate)) as avg_resting_hr,
            ROUND(AVG(sleep_hours)::numeric, 1) as avg_sleep_hours
         FROM health_data
         WHERE user_id = $1 AND date BETWEEN $3::date - ($2::int - 1) AND $3::date
         GROUP BY week_start
         ORDER BY week_start DESC`,
        [userId, days, date]
    );

    res.json({
        daily: result.rows,
        weekly: weeklyResult.rows,
    });
}));

module.exports = router;
