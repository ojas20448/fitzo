const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');
const xpService = require('../services/xpService');
const { invalidateContextPack } = require('../services/contextPack');

// All routes require authentication
router.use(authenticate);

/**
 * Normalize a client-reported target muscle (e.g. 'pectorals', 'quads',
 * 'upper back') into the six buckets the heatmap/volume features use.
 */
function normalizeMuscle(target) {
    if (!target) return null;
    const t = String(target).toLowerCase().trim();
    const MAP = {
        pectorals: 'chest', chest: 'chest',
        delts: 'shoulders', shoulders: 'shoulders', 'rear delts': 'shoulders',
        traps: 'back', lats: 'back', 'upper back': 'back', 'lower back': 'back', back: 'back',
        biceps: 'arms', triceps: 'arms', forearms: 'arms', arms: 'arms',
        quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', legs: 'legs', adductors: 'legs', abductors: 'legs',
        abs: 'core', core: 'core', obliques: 'core',
    };
    return MAP[t] || null;
}

/**
 * Mirror a Smart Log (flat JSON in workout_logs) into the structured
 * workout_sessions / exercise_logs / set_logs tables.
 *
 * WHY: the AI coach context pack, progress charts, PRs, and weekly recap all
 * read from the structured tables — without this bridge, workouts logged via
 * the app's main flow are invisible to every analytics + AI feature.
 *
 * Best-effort: failures are logged, never break the main logging flow.
 * Idempotent per day+type: re-logging replaces today's mirrored session.
 */
async function mirrorToStructuredLogs(userId, workoutType, exercisesJson, visibility, durationMinutes) {
    let parsed;
    try {
        parsed = JSON.parse(exercisesJson);
    } catch {
        return; // free-text exercises — nothing to mirror
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    // Replace any session already mirrored today for this workout type
    await query(
        `DELETE FROM workout_sessions
         WHERE user_id = $1 AND day_name = $2 AND notes = 'smart-log'
           AND started_at::date = CURRENT_DATE`,
        [userId, workoutType]
    );

    const sessionResult = await query(
        `INSERT INTO workout_sessions (user_id, day_name, visibility, notes, completed_at, duration_minutes)
         VALUES ($1, $2, $3, 'smart-log', NOW(), $4)
         RETURNING id`,
        [userId, workoutType, visibility, durationMinutes || null]
    );
    const sessionId = sessionResult.rows[0].id;

    for (let i = 0; i < parsed.length; i++) {
        const ex = parsed[i];
        if (!ex || !ex.name) continue;
        const name = String(ex.name).trim();

        // Match against the exercises table: exact first, then containment either
        // way ("Barbell Bench Press" contains "Bench Press"), longest name wins.
        const match = await query(
            `SELECT id FROM exercises
             WHERE LOWER(name) = LOWER($1)
                OR LOWER($1) LIKE '%' || LOWER(name) || '%'
                OR LOWER(name) LIKE '%' || LOWER($1) || '%'
             ORDER BY (LOWER(name) = LOWER($1)) DESC, LENGTH(name) DESC
             LIMIT 1`,
            [name]
        );
        const exerciseId = match.rows[0]?.id || null;

        // The client already knows the muscle — store it so volume/heatmap
        // attribution works even without a catalog match.
        const muscle = normalizeMuscle(ex.target) || normalizeMuscle(workoutType);

        const logResult = await query(
            `INSERT INTO exercise_logs (session_id, exercise_id, custom_exercise_name, order_index, muscle_group)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [sessionId, exerciseId, exerciseId ? null : name.slice(0, 100), i, muscle]
        );
        const exerciseLogId = logResult.rows[0].id;

        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        for (let s = 0; s < sets.length; s++) {
            const reps = parseInt(sets[s].reps, 10) || 0;
            const weight = parseFloat(sets[s].weight_kg) || 0;
            if (reps <= 0 && weight <= 0) continue;
            // RIR → RPE (rpe = 10 - rir), clamped to a sane 1–10
            const rir = parseInt(sets[s].rir, 10);
            const rpe = Number.isFinite(rir) ? Math.min(10, Math.max(1, 10 - rir)) : null;
            await query(
                `INSERT INTO set_logs (exercise_log_id, set_number, reps, weight_kg, is_warmup, rpe)
                 VALUES ($1, $2, $3, $4, false, $5)`,
                [exerciseLogId, s + 1, reps, weight, rpe]
            );
        }
    }
}

// ============================================
// LOG A WORKOUT
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workout_type, exercises, notes, visibility = 'friends', duration_minutes } = req.body;

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
    }

    const isNewLog = existingLog.rows.length === 0;

    // Award XP through xpService so it lands in xp_logs — the weekly gym
    // leaderboard reads xp_logs, not users.xp_points (was a direct UPDATE
    // before, which meant workouts never counted toward the leaderboard)
    if (isNewLog) {
        await xpService.awardXP(userId, 15, 'workout', result.rows[0].id);
    }

    // Mirror into structured tables so the AI coach, progress charts, PRs and
    // weekly recap can see this workout (best-effort, never blocks the log)
    if (exercises) {
        try {
            await mirrorToStructuredLogs(userId, workout_type, exercises, visibility, parseInt(duration_minutes, 10) || null);
        } catch (err) {
            console.error('Smart Log mirror failed (workout still saved):', err.message);
        }
    }

    // Coach context should reflect this workout immediately
    invalidateContextPack(userId).catch(() => {});

    // Auto-mark attendance for streak tracking
    const attendanceResult = await query(
        `INSERT INTO attendances (user_id, gym_id, check_date)
         VALUES ($1, (SELECT gym_id FROM users WHERE id = $1), CURRENT_DATE)
         ON CONFLICT (user_id, check_date) DO NOTHING
         RETURNING id`,
        [userId]
    );

    const checkinXpEarned = attendanceResult.rows.length > 0 ? 5 : 0;
    if (checkinXpEarned > 0) {
        await xpService.awardXP(userId, checkinXpEarned, 'checkin');
    }

    res.json({
        success: true,
        workout: result.rows[0],
        xp_earned: (isNewLog ? 15 : 0) + checkinXpEarned
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

    // Compare as text — workout_type is an enum, and an unknown value in the
    // query param should mean "not found", not a Postgres 22P02 cast error
    const result = await query(
        `SELECT * FROM workout_logs
         WHERE user_id = $1 AND workout_type::text = $2
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
