/**
 * Workout Sessions API
 * Log workouts with exercises, sets, reps, and weight
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../utils/errors');

/**
 * GET /api/workouts/exercises
 * Get all exercises, optionally filtered by category
 */
router.get('/exercises', authenticate, asyncHandler(async (req, res) => {
    const { category, search } = req.query;

    let sql = `SELECT id, name, category, equipment, muscle_groups, is_compound 
               FROM exercises WHERE 1=1`;
    const params = [];

    if (category) {
        params.push(category);
        sql += ` AND category = $${params.length}`;
    }

    if (search) {
        params.push(`%${search}%`);
        sql += ` AND name ILIKE $${params.length}`;
    }

    sql += ' ORDER BY name';

    const result = await query(sql, params);

    res.json({ exercises: result.rows });
}));

/**
 * GET /api/workouts/sessions
 * Get user's workout sessions
 */
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    const result = await query(
        `SELECT ws.*, 
            (SELECT COUNT(*) FROM exercise_logs WHERE session_id = ws.id) as exercise_count
         FROM workout_sessions ws
         WHERE ws.user_id = $1
         ORDER BY ws.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ sessions: result.rows });
}));

/**
 * GET /api/workouts/sessions/:id
 * Get full workout session with all exercises and sets
 */
router.get('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Get session
    const sessionResult = await query(
        `SELECT ws.*, u.name as user_name, u.avatar_url
         FROM workout_sessions ws
         JOIN users u ON ws.user_id = u.id
         WHERE ws.id = $1 AND (ws.user_id = $2 OR ws.visibility = 'public')`,
        [id, userId]
    );

    if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get exercises with sets
    const exercisesResult = await query(
        `SELECT el.*, e.name as exercise_name, e.category, e.muscle_groups,
            (SELECT json_agg(
                json_build_object(
                    'id', sl.id,
                    'set_number', sl.set_number,
                    'reps', sl.reps,
                    'weight_kg', sl.weight_kg,
                    'is_warmup', sl.is_warmup,
                    'is_failure', sl.is_failure,
                    'rpe', sl.rpe
                ) ORDER BY sl.set_number
            ) FROM set_logs sl WHERE sl.exercise_log_id = el.id) as sets
         FROM exercise_logs el
         LEFT JOIN exercises e ON el.exercise_id = e.id
         WHERE el.session_id = $1
         ORDER BY el.order_index`,
        [id]
    );

    res.json({
        session: {
            ...session,
            exercises: exercisesResult.rows.map(ex => ({
                ...ex,
                name: ex.exercise_name || ex.custom_exercise_name,
                sets: ex.sets || [],
            })),
        },
    });
}));

/**
 * POST /api/workouts/sessions
 * Start a new workout session
 */
router.post('/sessions', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { split_id, day_name, visibility = 'friends' } = req.body;

    const result = await query(
        `INSERT INTO workout_sessions (user_id, split_id, day_name, visibility, started_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [userId, split_id, day_name, visibility]
    );

    res.status(201).json({
        message: 'Workout started!',
        session: result.rows[0],
    });
}));

/**
 * PUT /api/workouts/sessions/:id/complete
 * Complete a workout session
 */
router.put('/sessions/:id/complete', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    // 1. Calculate Session Volume & Duration
    const statsResult = await query(
        `WITH session_volume AS (
            SELECT SUM(sl.reps * sl.weight_kg) as total_volume,
                   COUNT(DISTINCT sl.id) as total_sets,
                   COUNT(DISTINCT el.exercise_id) as total_exercises
            FROM exercise_logs el
            JOIN set_logs sl ON el.id = sl.exercise_log_id
            WHERE el.session_id = $1
        )
        UPDATE workout_sessions 
        SET completed_at = NOW(), 
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60,
            notes = $3
        WHERE id = $1 AND user_id = $2
        RETURNING *, (SELECT total_volume FROM session_volume) as volume, (SELECT total_sets FROM session_volume) as sets`,
        [id, userId, notes]
    );

    if (statsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const session = statsResult.rows[0];

    // 2. Check for PRs (Personal Records)
    // Find max weight for each exercise in this session vs all time previous
    const prResult = await query(
        `SELECT e.name, session_max.exercise_id, session_max.max_weight as new_record,
                COALESCE(history_max.max_weight, 0) as old_record
         FROM (
             SELECT el.exercise_id, MAX(sl.weight_kg) as max_weight
             FROM exercise_logs el
             JOIN set_logs sl ON el.id = sl.exercise_log_id
             WHERE el.session_id = $1
             GROUP BY el.exercise_id
         ) session_max
         JOIN exercises e ON session_max.exercise_id = e.id
         LEFT JOIN (
             SELECT el.exercise_id, MAX(sl.weight_kg) as max_weight
             FROM workout_sessions ws
             JOIN exercise_logs el ON ws.id = el.session_id
             JOIN set_logs sl ON el.id = sl.exercise_log_id
             WHERE ws.user_id = $2 
               AND ws.completed_at IS NOT NULL 
               AND ws.id != $1
             GROUP BY el.exercise_id
         ) history_max ON session_max.exercise_id = history_max.exercise_id
         WHERE session_max.max_weight > COALESCE(history_max.max_weight, 0)`,
        [id, userId]
    );

    const prs = prResult.rows.map(row => ({
        exerciseName: row.name,
        newWeight: row.new_record,
        improvement: row.new_record - row.old_record
    }));

    // 3. Generate Achievements
    const achievements = [];
    if (session.volume > 10000) achievements.push({ icon: 'fitness-center', title: 'Volume Monster', desc: '> 10,000kg moved' });
    if (session.duration_minutes > 90) achievements.push({ icon: 'timer', title: 'Marathon', desc: 'Long session!' });
    const hour = new Date().getHours();
    if (hour < 8) achievements.push({ icon: 'wb-sunny', title: 'Early Bird', desc: 'Morning workout' });
    if (hour > 20) achievements.push({ icon: 'nights-stay', title: 'Night Owl', desc: 'Late night pump' });
    if (prs.length > 0) achievements.push({ icon: 'emoji-events', title: 'PR Breaker', desc: `${prs.length} new records!` });

    res.json({
        message: 'Workout completed! 💪',
        session,
        recap: {
            duration: Math.round(session.duration_minutes),
            volume: session.volume || 0,
            sets: session.sets || 0,
            prs,
            achievements
        }
    });
}));

/**
 * POST /api/workouts/sessions/:id/exercises
 * Add an exercise to a session
 */
router.post('/sessions/:sessionId/exercises', authenticate, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { exercise_id, custom_exercise_name, notes } = req.body;

    // Verify session ownership
    const sessionCheck = await query(
        `SELECT id FROM workout_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // Get next order index
    const orderResult = await query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 as next_order 
         FROM exercise_logs WHERE session_id = $1`,
        [sessionId]
    );

    const result = await query(
        `INSERT INTO exercise_logs (session_id, exercise_id, custom_exercise_name, order_index, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [sessionId, exercise_id, custom_exercise_name, orderResult.rows[0].next_order, notes]
    );

    res.status(201).json({
        exercise_log: result.rows[0],
    });
}));

/**
 * POST /api/workouts/exercises/:exerciseLogId/sets
 * Log a set for an exercise
 */
router.post('/exercises/:exerciseLogId/sets', authenticate, asyncHandler(async (req, res) => {
    const { exerciseLogId } = req.params;
    const { reps, weight_kg, is_warmup, is_failure, rpe } = req.body;

    // Get next set number
    const setNumResult = await query(
        `SELECT COALESCE(MAX(set_number), 0) + 1 as next_set 
         FROM set_logs WHERE exercise_log_id = $1`,
        [exerciseLogId]
    );

    const result = await query(
        `INSERT INTO set_logs (exercise_log_id, set_number, reps, weight_kg, is_warmup, is_failure, rpe)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [exerciseLogId, setNumResult.rows[0].next_set, reps, weight_kg, is_warmup, is_failure, rpe]
    );

    res.status(201).json({
        set: result.rows[0],
    });
}));

/**
 * PUT /api/workouts/sets/:id
 * Update a set log (weight, reps, rpe)
 */
router.put('/sets/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reps, weight_kg, is_warmup, is_failure, rpe } = req.body;
    const userId = req.user.id;

    // Verify ownership (via session -> user)
    const checkOwner = await query(
        `SELECT sl.id 
         FROM set_logs sl
         JOIN exercise_logs el ON sl.exercise_log_id = el.id
         JOIN workout_sessions ws ON el.session_id = ws.id
         WHERE sl.id = $1 AND ws.user_id = $2`,
        [id, userId]
    );

    if (checkOwner.rows.length === 0) {
        return res.status(404).json({ error: 'Set not found' });
    }

    const result = await query(
        `UPDATE set_logs 
         SET reps = COALESCE($2, reps), 
             weight_kg = COALESCE($3, weight_kg), 
             is_warmup = COALESCE($4, is_warmup), 
             is_failure = COALESCE($5, is_failure), 
             rpe = COALESCE($6, rpe)
         WHERE id = $1
         RETURNING *`,
        [id, reps, weight_kg, is_warmup, is_failure, rpe]
    );

    res.json({
        set: result.rows[0],
    });
}));

/**
 * GET /api/workouts/feed
 * Get friends' recent workouts
 */
router.get('/feed', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;

    // Get friend IDs
    const friendsResult = await query(
        `SELECT friend_id FROM friendships 
         WHERE user_id = $1 AND status = 'accepted'`,
        [userId]
    );
    const friendIds = friendsResult.rows.map(r => r.friend_id);

    // Get public workouts from gym members and friends' workouts
    const result = await query(
        `SELECT ws.*, u.name as user_name, u.avatar_url,
            (SELECT COUNT(*) FROM exercise_logs WHERE session_id = ws.id) as exercise_count
         FROM workout_sessions ws
         JOIN users u ON ws.user_id = u.id
         WHERE ws.completed_at IS NOT NULL
           AND ws.user_id != $1
           AND (
               (ws.visibility = 'public' AND u.gym_id = $2)
               OR (ws.visibility = 'friends' AND ws.user_id = ANY($3))
           )
         ORDER BY ws.completed_at DESC
         LIMIT 20`,
        [userId, gymId, friendIds]
    );

    res.json({ workouts: result.rows });
}));

/**
 * GET /api/workouts/splits
 * Get user's saved splits
 */
router.get('/splits', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM user_splits WHERE user_id = $1 AND is_active = true`,
        [userId]
    );

    res.json({ splits: result.rows });
}));

/**
 * POST /api/workouts/splits
 * Save a user's split
 */
router.post('/splits', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { split_id, name, days, days_per_week } = req.body;

    if (!name || !days || days.length === 0) {
        throw new ValidationError('Name and days are required');
    }

    // Deactivate existing splits
    await query(
        `UPDATE user_splits SET is_active = false WHERE user_id = $1`,
        [userId]
    );

    // Save new split
    const result = await query(
        `INSERT INTO user_splits (user_id, split_id, name, days, days_per_week)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, split_id, name, days, days_per_week || days.length]
    );

    res.status(201).json({
        message: 'Split saved!',
        split: result.rows[0],
    });
}));

module.exports = router;
