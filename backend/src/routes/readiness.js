/**
 * Readiness Check-In Routes
 * Phase 1: Manual morning check-in (energy, sleep, soreness)
 * Computes a readiness score and workout recommendation
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../utils/errors');

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
    if (sleep_hours) {
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
        message: "You're primed. Push hard today -- PR territory."
    };
    if (score >= 70) return {
        recommendation: 'push',
        message: "Solid readiness. Good session ahead -- stick to plan."
    };
    if (score >= 50) return {
        recommendation: 'normal',
        message: "Decent energy. Train as planned, listen to your body."
    };
    if (score >= 30) return {
        recommendation: 'light',
        message: "Below average. Consider lighter weights or active recovery."
    };
    return {
        recommendation: 'deload',
        message: "Low readiness. Prioritize rest or easy mobility work today."
    };
}

/**
 * POST /api/readiness/checkin
 * Log today's morning check-in
 */
router.post('/checkin', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { energy_level, sleep_quality, soreness, sleep_hours, notes } = req.body;

    if (!energy_level || !sleep_quality || !soreness) {
        throw new ValidationError('energy_level, sleep_quality, and soreness are required (1-5)');
    }

    for (const [field, val] of [['energy_level', energy_level], ['sleep_quality', sleep_quality], ['soreness', soreness]]) {
        const n = parseInt(val);
        if (isNaN(n) || n < 1 || n > 5) {
            throw new ValidationError(`${field} must be between 1 and 5`);
        }
    }

    const readiness_score = computeReadiness({ energy_level, sleep_quality, soreness, sleep_hours });
    const { recommendation, message: recommendation_message } = getRecommendation(readiness_score);

    const result = await query(
        `INSERT INTO readiness_logs
         (user_id, energy_level, sleep_quality, soreness, sleep_hours,
          readiness_score, recommendation, recommendation_message, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, log_date)
         DO UPDATE SET
           energy_level = EXCLUDED.energy_level,
           sleep_quality = EXCLUDED.sleep_quality,
           soreness = EXCLUDED.soreness,
           sleep_hours = EXCLUDED.sleep_hours,
           readiness_score = EXCLUDED.readiness_score,
           recommendation = EXCLUDED.recommendation,
           recommendation_message = EXCLUDED.recommendation_message,
           notes = EXCLUDED.notes,
           created_at = NOW()
         RETURNING *`,
        [userId, energy_level, sleep_quality, soreness, sleep_hours || null,
         readiness_score, recommendation, recommendation_message, notes || null]
    );

    res.json({
        success: true,
        readiness: result.rows[0]
    });
}));

/**
 * GET /api/readiness/today
 * Get today's check-in (if exists)
 */
router.get('/today', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM readiness_logs
         WHERE user_id = $1 AND log_date = CURRENT_DATE`,
        [userId]
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
router.get('/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 7, 30);

    const result = await query(
        `SELECT * FROM readiness_logs
         WHERE user_id = $1
           AND log_date >= CURRENT_DATE - INTERVAL '1 day' * $2
         ORDER BY log_date DESC`,
        [userId, days]
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
