const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

/**
 * GET /api/measurements/latest
 * Get user's most recent body measurements
 */
router.get('/latest', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM body_measurements 
         WHERE user_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 1`,
        [userId]
    );

    res.json({ measurement: result.rows[0] || null });
}));

/**
 * POST /api/measurements
 * Log new body measurements
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        weight,
        body_fat,
        chest,
        waist,
        hips,
        neck,
        shoulders,
        left_arm,
        right_arm,
        left_thigh,
        right_thigh,
        left_calf,
        right_calf,
        notes
    } = req.body;

    const result = await query(
        `INSERT INTO body_measurements (
            user_id, weight, body_fat, chest, waist, hips, 
            neck, shoulders, left_arm, right_arm, 
            left_thigh, right_thigh, left_calf, right_calf, 
            notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
            userId, weight, body_fat, chest, waist, hips,
            neck, shoulders, left_arm, right_arm,
            left_thigh, right_thigh, left_calf, right_calf,
            notes
        ]
    );

    // Also update current weight in nutrition profile if provided
    if (weight) {
        await query(
            `UPDATE nutrition_profiles 
             SET weight_kg = $1, updated_at = NOW() 
             WHERE user_id = $2`,
            [weight, userId]
        );
    }

    res.json({
        message: 'Measurements logged successfully',
        measurement: result.rows[0]
    });
}));

/**
 * GET /api/measurements/history
 * Get history of measurements
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = req.query.limit || 10;

    const result = await query(
        `SELECT * FROM body_measurements 
         WHERE user_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT $2`,
        [userId, limit]
    );

    res.json({ history: result.rows });
}));

module.exports = router;
