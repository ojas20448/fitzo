const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, ConflictError, NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * POST /api/checkin
 * QR Check-in - creates attendance record
 * 
 * Constraints:
 * - One check-in per day per user
 * - QR provides gym_id
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { gym_id } = req.body;

    if (!gym_id) {
        throw new ValidationError('Invalid QR code. Please try scanning again.');
    }

    // Verify gym exists
    const gymResult = await query(
        'SELECT id, name FROM gyms WHERE id = $1',
        [gym_id]
    );

    if (gymResult.rows.length === 0) {
        throw new NotFoundError("This QR code doesn't seem to be valid");
    }

    const gym = gymResult.rows[0];

    // Check if already checked in today
    const existingCheckin = await query(
        `SELECT id FROM attendances 
     WHERE user_id = $1 
     AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
        [userId]
    );

    if (existingCheckin.rows.length > 0) {
        throw new ConflictError("You've already checked in today! 💪");
    }

    // Create check-in
    await query(
        `INSERT INTO attendances (user_id, gym_id) VALUES ($1, $2)`,
        [userId, gym_id]
    );

    // Calculate new streak
    const streakResult = await query(
        `SELECT get_user_streak($1) as streak`,
        [userId]
    );

    const streak = parseInt(streakResult.rows[0].streak) || 1;

    res.status(201).json({
        success: true,
        message: "You're checked in! 💪",
        gym_name: gym.name,
        streak,
        animation: 'success'  // Trigger frontend animation
    });
}));

/**
 * GET /api/checkin/status
 * Get today's check-in status
 */
router.get('/status', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT id, checked_in_at, gym_id 
     FROM attendances 
     WHERE user_id = $1 
     AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
        [userId]
    );

    if (result.rows.length === 0) {
        return res.json({
            checked_in: false,
            checked_in_at: null
        });
    }

    res.json({
        checked_in: true,
        checked_in_at: result.rows[0].checked_in_at,
        gym_id: result.rows[0].gym_id
    });
}));

/**
 * GET /api/checkin/history
 * Get check-in history (for streak visualization)
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    const result = await query(
        `SELECT DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') as date
     FROM attendances 
     WHERE user_id = $1 
     AND checked_in_at > NOW() - INTERVAL '1 day' * $2
     ORDER BY checked_in_at DESC`,
        [userId, days]
    );

    // Get current streak
    const streakResult = await query(
        `SELECT get_user_streak($1) as streak`,
        [userId]
    );

    res.json({
        dates: result.rows.map(r => r.date),
        current_streak: parseInt(streakResult.rows[0].streak) || 0,
        total_check_ins: result.rows.length
    });
}));

module.exports = router;
