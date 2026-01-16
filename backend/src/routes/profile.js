const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Get fitness profile (goals, weight, etc.)
router.get('/fitness', authenticate, async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM fitness_profiles WHERE user_id = $1',
            [req.user.id]
        );

        // If no profile, return default
        const profile = result.rows[0] || {
            goal_type: 'maintenance',
            activity_level: 'sedentary',
            current_weight: null,
            target_weight: null
        };

        // Also get latest measurements
        const measurements = await query(
            'SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1',
            [req.user.id]
        );

        res.json({
            profile: profile,
            latest_measurements: measurements.rows[0] || null
        });
    } catch (err) {
        next(err);
    }
});

// Update fitness profile
router.put('/fitness', authenticate, async (req, res, next) => {
    const {
        goal_type,
        current_weight,
        target_weight,
        height,
        age,
        gender,
        activity_level,
        target_calories
    } = req.body;

    try {
        const result = await query(
            `INSERT INTO fitness_profiles 
            (user_id, goal_type, current_weight, target_weight, height, age, gender, activity_level, target_calories, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                goal_type = EXCLUDED.goal_type,
                current_weight = EXCLUDED.current_weight,
                target_weight = EXCLUDED.target_weight,
                height = EXCLUDED.height,
                age = EXCLUDED.age,
                gender = EXCLUDED.gender,
                activity_level = EXCLUDED.activity_level,
                target_calories = EXCLUDED.target_calories,
                updated_at = NOW()
            RETURNING *`,
            [req.user.id, goal_type, current_weight, target_weight, height, age, gender, activity_level, target_calories]
        );

        res.json({ success: true, profile: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// Log body measurements
router.post('/measurements', authenticate, async (req, res, next) => {
    const { weight, body_fat, chest, waist, hips, arms, thighs, notes } = req.body;

    try {
        // Log to history
        const result = await query(
            `INSERT INTO body_measurements 
            (user_id, weight, body_fat, chest, waist, hips, arms, thighs, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [req.user.id, weight, body_fat, chest, waist, hips, arms, thighs, notes]
        );

        // Also update current weight in profile if provided
        if (weight) {
            await query(
                `INSERT INTO fitness_profiles (user_id, current_weight, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET current_weight = $2, updated_at = NOW()`,
                [req.user.id, weight]
            );
        }

        res.json({ success: true, measurement: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// Get measurement history
router.get('/measurements', authenticate, async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
