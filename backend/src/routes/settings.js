const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../utils/errors');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/settings/sharing
 * Get user's sharing preferences
 */
router.get('/sharing', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT share_logs_default, share_logs_updated_at
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        share_logs_default: result.rows[0].share_logs_default,
        updated_at: result.rows[0].share_logs_updated_at
    });
}));

/**
 * PATCH /api/settings/sharing
 * Update user's sharing preferences
 */
router.patch('/sharing', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { share_logs_default } = req.body;

    // Validate input
    if (typeof share_logs_default !== 'boolean') {
        throw new ValidationError('share_logs_default must be a boolean');
    }

    // Update user's sharing preference
    const result = await query(
        `UPDATE users
         SET share_logs_default = $1,
             share_logs_updated_at = NOW()
         WHERE id = $2
         RETURNING share_logs_default, share_logs_updated_at`,
        [share_logs_default, userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        success: true,
        share_logs_default: result.rows[0].share_logs_default,
        updated_at: result.rows[0].share_logs_updated_at,
        message: share_logs_default
            ? 'Sharing enabled. Gym buddies can see your workouts and meals.'
            : 'Sharing disabled. Your logs are now private to buddies.'
    });
}));

module.exports = router;
