const express = require('express');
const router = express.Router();
const caloriesBurned = require('../services/calories-burned');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/workouts/calculate-calories
 * Calculate calories burned for a workout activity
 */
router.post('/calculate-calories', authenticate, async (req, res) => {
    try {
        const { activity, duration, weight } = req.body;

        if (!activity) {
            return res.status(400).json({ error: 'Activity is required' });
        }

        const userWeight = weight || req.user?.weight || 70; // fallback to 70kg
        const workoutDuration = duration || 60; // fallback to 60 min

        const results = await caloriesBurned.calculateCaloriesBurned(
            activity,
            workoutDuration,
            userWeight
        );

        res.json({
            success: true,
            calories: results,
            activity,
            duration: workoutDuration,
            weight: userWeight
        });
    } catch (error) {
        console.error('Error calculating calories:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
