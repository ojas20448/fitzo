/**
 * Readiness Check-In Routes
 * Phase 1: Manual morning check-in (energy, sleep, soreness)
 * Computes a readiness score and workout recommendation
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const { isValidDateString, memberDateString } = require('../utils/dayBoundary');
const { invalidateContextPack } = require('../services/contextPack');

const dateSchema = z.string().refine(isValidDateString, 'Use a valid YYYY-MM-DD date');
const checkinSchema = z.object({
    energy_level: z.number().int().min(1).max(5),
    sleep_quality: z.number().int().min(1).max(5),
    soreness: z.number().int().min(1).max(5),
    sleep_hours: z.number().min(0).max(24).nullable().optional(),
    notes: z.string().max(1000).optional(),
    date: dateSchema.optional(),
});

router.use(authenticate);

/**
 * Compute readiness score (0-100) from subjective inputs
 * Energy 35% | Sleep quality 30% | Inverse-soreness 25% | Sleep hours bonus 10%
 */
function computeReadiness({ energy_level, sleep_quality, soreness, sleep_hours }) {
    const energyScore   = ((energy_level - 1) / 4) * 35;
    const sleepScore    = ((sleep_quality - 1) / 4) * 30;
    const sorenessScore = ((5 - soreness) / 4) * 25; // inverted: less soreness = better

    // Sleep hours bonus: optimal is 7-9h
    let hoursBonus = 0;
    if (sleep_hours != null) {
        if (sleep_hours >= 7 && sleep_hours <= 9) hoursBonus = 10;
        else if (sleep_hours >= 6 && sleep_hours < 7)  hoursBonus = 6;
        else if (sleep_hours > 9 && sleep_hours <= 10) hoursBonus = 7;
        else if (sleep_hours >= 5 && sleep_hours < 6)  hoursBonus = 3;
        else hoursBonus = 0;
    } else {
        hoursBonus = 5; // partial credit when not provided
    }

    return Math.round(energyScore + sleepScore + sorenessScore + hoursBonus);
}

function getRecommendation(score) {
    if (score >= 85) return {
        recommendation: 'peak',
        message: 'You reported high energy and good recovery. Choose your effort based on how you feel during warm-up.'
    };
    if (score >= 70) return {
        recommendation: 'push',
        message: 'You reported generally good recovery. Adjust your session to how you feel.'
    };
    if (score >= 50) return {
        recommendation: 'normal',
        message: 'Your ratings are mixed. Consider how you feel before choosing your session.'
    };
    if (score >= 30) return {
        recommendation: 'light',
        message: 'You reported lower recovery. A lighter session or rest may suit you today.'
    };
    return {
        recommendation: 'deload',
        message: 'You reported low energy or recovery. Consider rest or an easier session.'
    };
}

/**
 * POST /api/readiness/checkin
 * Log today's morning check-in
 */
router.post('/checkin', validate({ body: checkinSchema }), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { energy_level, sleep_quality, soreness, sleep_hours, notes, date } = req.body;

    const readiness_score = computeReadiness({ energy_level, sleep_quality, soreness, sleep_hours });
    const { recommendation, message: recommendation_message } = getRecommendation(readiness_score);

    const result = await query(
        `INSERT INTO readiness_logs
         (user_id, energy_level, sleep_quality, soreness, sleep_hours,
          log_date,
          readiness_score, recommendation, recommendation_message, notes)
         VALUES ($1, $2, $3, $4, $5, $10::date, $6, $7, $8, $9)
         ON CONFLICT (user_id, log_date)
         DO UPDATE SET
           energy_level = EXCLUDED.energy_level,
           sleep_quality = EXCLUDED.sleep_quality,
           soreness = EXCLUDED.soreness,
           sleep_hours = EXCLUDED.sleep_hours,
           readiness_score = EXCLUDED.readiness_score,
           recommendation = EXCLUDED.recommendation,
           recommendation_message = EXCLUDED.recommendation_message,
           notes = CASE WHEN $11::boolean THEN EXCLUDED.notes ELSE readiness_logs.notes END,
           created_at = NOW()
         RETURNING *`,
        [userId, energy_level, sleep_quality, soreness, sleep_hours ?? null,
         readiness_score, recommendation, recommendation_message, notes || null, date || memberDateString(new Date(), req.user.timezone), notes !== undefined]
    );

    await invalidateContextPack(userId);

    res.json({
        success: true,
        readiness: result.rows[0]
    });
}));

/**
 * GET /api/readiness/today
 * Get today's check-in (if exists)
 */
router.get('/today', validate({ query: z.object({ date: dateSchema.optional() }) }), asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM readiness_logs
         WHERE user_id = $1 AND log_date = $2::date`,
        [userId, req.query.date || memberDateString(new Date(), req.user.timezone)]
    );

    if (result.rows.length === 0) {
        return res.json({ checked_in: false, readiness: null });
    }

    res.json({
        checked_in: true,
        readiness: result.rows[0]
    });
}));

/**
 * GET /api/readiness/history?days=7
 * Get recent check-in history
 */
router.get('/history', validate({ query: z.object({
    date: dateSchema.optional(), days: z.coerce.number().int().min(1).max(30).default(7),
}) }), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const days = req.query.days;

    const result = await query(
        `SELECT * FROM readiness_logs
         WHERE user_id = $1
           AND log_date BETWEEN $3::date - ($2::int - 1) AND $3::date
         ORDER BY log_date DESC`,
        [userId, days, req.query.date || memberDateString(new Date(), req.user.timezone)]
    );

    const avgScore = result.rows.length > 0
        ? Math.round(result.rows.reduce((s, r) => s + (r.readiness_score || 0), 0) / result.rows.length)
        : null;

    res.json({
        history: result.rows,
        avg_score: avgScore,
        days_logged: result.rows.length
    });
}));

module.exports = router;
