const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, invalidateUserCache } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');
const cache = require('../services/cache');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/settings/gym
 * Current gym membership info (or gym: null if not enrolled)
 */
router.get('/gym', asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT g.id, g.name, g.qr_code, g.capacity,
                (SELECT COUNT(*) FROM users m WHERE m.gym_id = g.id AND m.role = 'member')::int AS member_count
         FROM users u
         JOIN gyms g ON u.gym_id = g.id
         WHERE u.id = $1`,
        [req.user.id]
    );

    if (result.rows.length === 0) {
        return res.json({ gym: null });
    }

    const gym = result.rows[0];
    res.json({
        gym: {
            id: gym.id,
            name: gym.name,
            access_code: gym.qr_code,
            capacity: gym.capacity,
            member_count: gym.member_count,
        }
    });
}));

/**
 * POST /api/settings/gym
 * Join (or switch) gym using its access code
 * Body: { gym_code: string }
 */
router.post('/gym', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { gym_code } = req.body;

    if (!gym_code || typeof gym_code !== 'string' || !gym_code.trim()) {
        throw new ValidationError('Please enter your gym access code');
    }

    const gymResult = await query(
        'SELECT id, name, capacity FROM gyms WHERE qr_code = $1',
        [gym_code.trim().toUpperCase()]
    );

    if (gymResult.rows.length === 0) {
        throw new NotFoundError("That access code doesn't match any gym. Ask your gym's front desk!");
    }

    const gym = gymResult.rows[0];

    if (req.user.gym_id === gym.id) {
        return res.json({
            success: true,
            message: `You're already a member of ${gym.name}! 💪`,
            gym: { id: gym.id, name: gym.name },
        });
    }

    await query('UPDATE users SET gym_id = $1 WHERE id = $2', [gym.id, userId]);

    // Auth middleware caches user (incl. gym_id) — must invalidate
    await invalidateUserCache(userId);
    await cache.del(cache.keys.homeData(userId));

    res.json({
        success: true,
        message: `Welcome to ${gym.name}! 🏋️`,
        gym: { id: gym.id, name: gym.name },
    });
}));

/**
 * DELETE /api/settings/gym
 * Leave current gym
 */
router.delete('/gym', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    if (!req.user.gym_id) {
        throw new ValidationError("You're not enrolled in a gym right now");
    }

    await query('UPDATE users SET gym_id = NULL WHERE id = $1', [userId]);
    await invalidateUserCache(userId);
    await cache.del(cache.keys.homeData(userId));

    res.json({
        success: true,
        message: "You've left your gym. Join another anytime with an access code.",
    });
}));

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

/**
 * GET /api/settings/workout
 * Workout logging preferences (RIR opt-in, first-run sheet state).
 */
router.get('/workout', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT log_rir_enabled, workout_prefs_seen
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        log_rir_enabled: result.rows[0].log_rir_enabled,
        workout_prefs_seen: result.rows[0].workout_prefs_seen,
    });
}));

/**
 * PATCH /api/settings/workout
 * Update either preference. Both fields are optional; at least one required.
 */
router.patch('/workout', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { log_rir_enabled, workout_prefs_seen } = req.body;

    const hasRir = log_rir_enabled !== undefined;
    const hasSeen = workout_prefs_seen !== undefined;

    if (!hasRir && !hasSeen) {
        throw new ValidationError('Provide log_rir_enabled or workout_prefs_seen');
    }
    if (hasRir && typeof log_rir_enabled !== 'boolean') {
        throw new ValidationError('log_rir_enabled must be a boolean');
    }
    if (hasSeen && typeof workout_prefs_seen !== 'boolean') {
        throw new ValidationError('workout_prefs_seen must be a boolean');
    }

    // COALESCE keeps the untouched field at its current value, so a partial
    // PATCH cannot silently reset the other preference.
    const result = await query(
        `UPDATE users
            SET log_rir_enabled    = COALESCE($1, log_rir_enabled),
                workout_prefs_seen = COALESCE($2, workout_prefs_seen)
          WHERE id = $3
      RETURNING log_rir_enabled, workout_prefs_seen`,
        [hasRir ? log_rir_enabled : null, hasSeen ? workout_prefs_seen : null, userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        success: true,
        log_rir_enabled: result.rows[0].log_rir_enabled,
        workout_prefs_seen: result.rows[0].workout_prefs_seen,
    });
}));

/**
 * GET /api/settings/learn
 * Learn surface preferences.
 */
router.get('/learn', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT learn_start_here_dismissed FROM users WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({ start_here_dismissed: result.rows[0].learn_start_here_dismissed });
}));

/**
 * PATCH /api/settings/learn
 */
router.patch('/learn', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { start_here_dismissed } = req.body;

    if (typeof start_here_dismissed !== 'boolean') {
        throw new ValidationError('start_here_dismissed must be a boolean');
    }

    const result = await query(
        `UPDATE users
            SET learn_start_here_dismissed = $1
          WHERE id = $2
      RETURNING learn_start_here_dismissed`,
        [start_here_dismissed, userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({ success: true, start_here_dismissed: result.rows[0].learn_start_here_dismissed });
}));

module.exports = router;
