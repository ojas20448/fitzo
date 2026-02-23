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
const { asyncHandler } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

const syncHealthSchema = z.object({
    steps: z.number().int().min(0).max(999999),
    active_calories: z.number().min(0).max(99999),
    resting_heart_rate: z.number().min(20).max(250).nullable().optional(),
    sleep_hours: z.number().min(0).max(24).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
});

router.use(authenticate);

// ===========================================
// ENSURE TABLE EXISTS
// ===========================================
query(`
    CREATE TABLE IF NOT EXISTS health_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        steps INTEGER DEFAULT 0,
        active_calories INTEGER DEFAULT 0,
        resting_heart_rate SMALLINT,
        sleep_hours NUMERIC(3,1),
        source TEXT DEFAULT 'manual',
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, date)
    )
`).catch(err => console.error('Could not create health_data table:', err.message));

// ===========================================
// POST /api/health/sync
// Upsert today's health data from wearable
// ===========================================
router.post('/sync', validate({ body: syncHealthSchema }), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        steps,
        active_calories,
        resting_heart_rate = null,
        sleep_hours = null,
        date,
    } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await query(
        `INSERT INTO health_data (user_id, date, steps, active_calories, resting_heart_rate, sleep_hours, source, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'wearable', NOW())
         ON CONFLICT (user_id, date)
         DO UPDATE SET
            steps = GREATEST(health_data.steps, EXCLUDED.steps),
            active_calories = GREATEST(health_data.active_calories, EXCLUDED.active_calories),
            resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, health_data.resting_heart_rate),
            sleep_hours = COALESCE(EXCLUDED.sleep_hours, health_data.sleep_hours),
            synced_at = NOW()
         RETURNING *`,
        [userId, targetDate, steps, active_calories, resting_heart_rate, sleep_hours]
    );

    res.json({ success: true, health: result.rows[0] });
}));

// ===========================================
// GET /api/health/today
// Get today's health summary
// ===========================================
router.get('/today', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM health_data WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId]
    );

    res.json({
        health: result.rows[0] || {
            steps: 0,
            active_calories: 0,
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
    const days = parseInt(req.query.days) || 30;

    const result = await query(
        `SELECT date, steps, active_calories, resting_heart_rate, sleep_hours
         FROM health_data
         WHERE user_id = $1 AND date >= CURRENT_DATE - $2::int
         ORDER BY date DESC`,
        [userId, days]
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
         WHERE user_id = $1 AND date >= CURRENT_DATE - $2::int
         GROUP BY week_start
         ORDER BY week_start DESC`,
        [userId, days]
    );

    res.json({
        daily: result.rows,
        weekly: weeklyResult.rows,
    });
}));

module.exports = router;
