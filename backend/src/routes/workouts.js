const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');

// All routes require authentication
router.use(authenticate);

// ============================================
// LOG A WORKOUT
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workout_type, exercises, notes, visibility = 'friends' } = req.body;

    // Validation
    const validTypes = ['legs', 'chest', 'back', 'shoulders', 'arms', 'cardio', 'rest'];
    if (!workout_type || !validTypes.includes(workout_type)) {
        throw new ValidationError('Please select a valid workout type');
    }

    const validVisibility = ['public', 'friends', 'private'];
    if (!validVisibility.includes(visibility)) {
        throw new ValidationError('Invalid visibility option');
    }

    // Check if already logged today for this type
    const existingLog = await query(
        `SELECT id FROM workout_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE AND workout_type = $2`,
        [userId, workout_type]
    );

    let result;
    if (existingLog.rows.length > 0) {
        // Update existing log
        result = await query(
            `UPDATE workout_logs 
             SET exercises = $1, notes = $2, visibility = $3, completed = true
             WHERE id = $4
             RETURNING *`,
            [exercises || null, notes || null, visibility, existingLog.rows[0].id]
        );
    } else {
        // Create new log
        result = await query(
            `INSERT INTO workout_logs (user_id, workout_type, exercises, notes, visibility)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, workout_type, exercises || null, notes || null, visibility]
        );

        // Award XP for logging
        await query(
            `UPDATE users SET xp_points = xp_points + 5 WHERE id = $1`,
            [userId]
        );
    }

    res.json({
        success: true,
        workout: result.rows[0],
        xp_earned: existingLog.rows.length > 0 ? 0 : 5
    });
}));

// ============================================
// GET TODAY'S WORKOUTS
// ============================================
router.get('/today', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM workout_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE
         ORDER BY created_at DESC`,
        [userId]
    );

    // Get daily summary
    const summaryResult = await query(
        `SELECT COUNT(*) as workout_count, 
                array_agg(DISTINCT workout_type) as types
         FROM workout_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE`,
        [userId]
    );

    res.json({
        workouts: result.rows,
        summary: {
            count: parseInt(summaryResult.rows[0].workout_count),
            types: summaryResult.rows[0].types || []
        }
    });
}));

// ============================================
// GET WORKOUT HISTORY
// ============================================
router.get('/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;

    const result = await query(
        `SELECT logged_date, 
                array_agg(json_build_object(
                    'id', id,
                    'workout_type', workout_type,
                    'exercises', exercises,
                    'completed', completed
                )) as workouts
         FROM workout_logs 
         WHERE user_id = $1
         GROUP BY logged_date
         ORDER BY logged_date DESC
         LIMIT $2`,
        [userId, limit]
    );

    // Send the response for history
    res.json({ history: result.rows });
}));

// ============================================
// GET LATEST WORKOUT BY TYPE
// ============================================
router.get('/latest', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type } = req.query;

    if (!type) {
        throw new ValidationError('Workout type is required');
    }

    const result = await query(
        `SELECT * FROM workout_logs 
         WHERE user_id = $1 AND workout_type = $2
         ORDER BY logged_date DESC, created_at DESC
         LIMIT 1`,
        [userId, type]
    );

    res.json({
        found: result.rows.length > 0,
        workout: result.rows[0] || null
    });
}));

// ============================================
// GET FRIENDS' WORKOUT FEED
// ============================================
router.get('/feed', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get workouts from friends (respecting privacy)
    const result = await query(
        `SELECT w.id, w.workout_type, w.exercises, w.notes, w.completed, 
                w.logged_date, w.created_at,
                u.id as user_id, u.name, u.avatar_url,
                (SELECT COUNT(*)::int FROM comments c WHERE c.workout_log_id = w.id) as comment_count
         FROM workout_logs w
         JOIN users u ON w.user_id = u.id
         WHERE w.logged_date >= CURRENT_DATE - INTERVAL '7 days'
         AND (
             -- Public workouts
             w.visibility = 'public'
             OR 
             -- Friends-only workouts from accepted friends
             (w.visibility = 'friends' AND EXISTS (
                 SELECT 1 FROM friendships f 
                 WHERE f.status = 'accepted'
                 AND ((f.user_id = $1 AND f.friend_id = w.user_id)
                      OR (f.friend_id = $1 AND f.user_id = w.user_id))
             ))
         )
         AND w.user_id != $1
         ORDER BY w.created_at DESC
         LIMIT 20`,
        [userId]
    );

    res.json({ feed: result.rows });
}));

// ============================================
// DELETE A WORKOUT LOG
// ============================================
router.delete('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const workoutId = req.params.id;

    const result = await query(
        `DELETE FROM workout_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
        [workoutId, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Workout not found');
    }

    res.json({ success: true });
}));

// ============================================
// GET MY SPLITS
// ============================================
router.get('/splits', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM user_splits WHERE user_id = $1 ORDER BY is_active DESC, created_at DESC`,
        [userId]
    );

    res.json({ splits: result.rows });
}));

module.exports = router;
