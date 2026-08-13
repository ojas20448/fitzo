const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, invalidateUserCache } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');
const cache = require('../services/cache');
const {
    WORKOUT_PREF_COLUMNS,
    readPrefs,
    planPrefUpdate,
} = require('../utils/workoutPrefs');

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
        `SELECT share_logs_default, share_logs_updated_at, friends_intro_seen
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        share_logs_default: result.rows[0].share_logs_default,
        updated_at: result.rows[0].share_logs_updated_at,
        // Drives the one-time "what your buddies can see" disclosure on the
        // Friends tab. Account-scoped, not device-scoped, so it does not
        // reappear on a new phone.
        friends_intro_seen: result.rows[0].friends_intro_seen
    });
}));

/**
 * PATCH /api/settings/sharing
 * Update user's sharing preferences
 */
router.patch('/sharing', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { share_logs_default, friends_intro_seen } = req.body;

    // Acknowledging the disclosure is its own PATCH and must not require
    // sending a sharing preference — otherwise dismissing the popup would
    // silently rewrite share_logs_default to whatever the client happened to
    // have in state.
    if (friends_intro_seen !== undefined) {
        if (typeof friends_intro_seen !== 'boolean') {
            throw new ValidationError('friends_intro_seen must be a boolean');
        }
        const ack = await query(
            `UPDATE users SET friends_intro_seen = $1 WHERE id = $2
             RETURNING friends_intro_seen`,
            [friends_intro_seen, userId]
        );
        if (ack.rows.length === 0) throw new ValidationError('User not found');
        if (share_logs_default === undefined) {
            return res.json({ success: true, friends_intro_seen: ack.rows[0].friends_intro_seen });
        }
    }

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
// Reading the row as jsonb instead of naming columns: a column added by a
// migration that has not run yet is simply absent from the object, where
// naming it would raise 42703 and 500 the whole endpoint — taking the older
// preferences down with the new ones. password_hash is stripped in SQL so the
// hash never enters the process.
const WORKOUT_PREF_ROW_SQL = `
    SELECT to_jsonb(u) - 'password_hash' AS prefs
      FROM users u
     WHERE u.id = $1
`;

router.get('/workout', asyncHandler(async (req, res) => {
    const result = await query(WORKOUT_PREF_ROW_SQL, [req.user.id]);

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json(readPrefs(result.rows[0].prefs));
}));

/**
 * PATCH /api/settings/workout
 * Update either preference. Both fields are optional; at least one required.
 */
router.patch('/workout', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Read first: the jsonb keys tell us which preference columns this database
    // actually has, so a write aimed at a not-yet-migrated column is deferred
    // rather than raising 42703 and failing the whole request.
    const current = await query(WORKOUT_PREF_ROW_SQL, [userId]);
    if (current.rows.length === 0) {
        throw new ValidationError('User not found');
    }
    const row = current.rows[0].prefs || {};

    const { requested, invalid, applicable, deferred } = planPrefUpdate(
        req.body,
        WORKOUT_PREF_COLUMNS.filter(col => col in row)
    );

    if (requested.length === 0) {
        throw new ValidationError(`Provide at least one of: ${WORKOUT_PREF_COLUMNS.join(', ')}`);
    }
    if (invalid.length > 0) {
        throw new ValidationError(`${invalid[0]} must be a boolean`);
    }

    let updated = row;

    if (applicable.length > 0) {
        // Only the supplied columns are assigned, so a partial PATCH cannot
        // reset the preferences it did not mention. Column names come from the
        // allow-list, never from user input, so they are safe to interpolate.
        const assignments = applicable.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const values = applicable.map(col => req.body[col]);

        const result = await query(
            `UPDATE users
                SET ${assignments}
              WHERE id = $${applicable.length + 1}
          RETURNING to_jsonb(users) - 'password_hash' AS prefs`,
            [...values, userId]
        );

        if (result.rows.length === 0) {
            throw new ValidationError('User not found');
        }
        updated = result.rows[0].prefs || {};
    }

    if (deferred.length > 0) {
        console.warn(
            `[settings/workout] ignoring ${deferred.join(', ')} — column(s) missing. ` +
            'Run backend/apply_migrations.js.'
        );
    }

    res.json({
        success: true,
        ...readPrefs(updated),
        // Surfaced rather than swallowed: the client gets its 200 and keeps
        // working, but the unapplied migration is visible instead of silent.
        ...(deferred.length > 0 ? { pending_migration: deferred } : {}),
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
