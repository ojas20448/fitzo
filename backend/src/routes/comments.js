const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

/**
 * GET /api/comments/:workoutId
 * Get all comments for a workout log
 */
router.get('/:workoutId', authenticate, asyncHandler(async (req, res) => {
    const { workoutId } = req.params;

    const result = await query(
        `SELECT c.id, c.content, c.created_at,
                u.id as user_id, u.name as user_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.workout_log_id = $1
         ORDER BY c.created_at ASC`,
        [workoutId]
    );

    res.json({
        comments: result.rows
    });
}));

/**
 * POST /api/comments/:workoutId
 * Post a new comment
 */
router.post('/:workoutId', authenticate, asyncHandler(async (req, res) => {
    const { workoutId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment content is required' });
    }

    const result = await query(
        `INSERT INTO comments (user_id, workout_log_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, content, created_at`,
        [userId, workoutId, content.trim()]
    );

    const newComment = result.rows[0];

    // Return formatted comment with user details (since we know the user)
    // We fetch user details from req.user (assuming it has name/avatar, or fetch from DB if needed)
    // Usually req.user has id, gym_id, role. Middleware might not fetch full profile.
    // Let's fetch the user details to be safe and consistent.
    const userResult = await query('SELECT name, avatar_url FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    res.status(201).json({
        comment: {
            ...newComment,
            user_id: userId,
            user_name: user.name,
            avatar_url: user.avatar_url
        }
    });
}));

module.exports = router;
