const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, ConflictError, NotFoundError, asyncHandler } = require('../utils/errors');
const pushNotifications = require('../services/pushNotifications');

/**
 * GET /api/friends
 * List all friends and pending requests
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get accepted friends with streak, last workout, and today's activity
    const friendsResult = await query(
        `SELECT
       u.id,
       u.name,
       u.avatar_url,
       u.xp_points,
       u.share_logs_default,
       wi.split_type,
       wi.emphasis,
       wi.session_label,
       wi.muscle_group,
       a.checked_in_at as last_checkin,
       get_user_streak(u.id) as streak,
       lw.last_workout_date,
       lw.last_workout_type,
       (EXISTS(
         SELECT 1 FROM workout_logs wl
         WHERE wl.user_id = u.id AND wl.logged_date = CURRENT_DATE
       ) OR EXISTS(
         SELECT 1 FROM workout_sessions ws
         WHERE ws.user_id = u.id AND ws.completed_at IS NOT NULL
         AND DATE(ws.completed_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
       )) as worked_out_today,
       EXISTS(
         SELECT 1 FROM calorie_logs cl
         WHERE cl.user_id = u.id AND cl.logged_date = CURRENT_DATE
       ) as logged_food_today
     FROM friendships f
     JOIN users u ON f.friend_id = u.id
     LEFT JOIN workout_intents wi ON (
       u.id = wi.user_id
       AND wi.expires_at > NOW()
       AND wi.visibility IN ('public', 'friends')
     )
     LEFT JOIN attendances a ON (
       u.id = a.user_id
       AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
     )
     LEFT JOIN LATERAL (
       SELECT logged_date as last_workout_date, workout_type as last_workout_type
       FROM workout_logs WHERE user_id = u.id
       ORDER BY logged_date DESC LIMIT 1
     ) lw ON true
     WHERE f.user_id = $1 AND f.status = 'accepted'
     ORDER BY a.checked_in_at DESC NULLS LAST, u.name`,
        [userId]
    );

    // Helper to format intent display
    const formatPattern = (p) => {
        if (!p) return null;
        const labels = {
            push: 'Push', pull: 'Pull', legs: 'Legs',
            upper: 'Upper', lower: 'Lower',
            anterior: 'Anterior', posterior: 'Posterior',
            full_body: 'Full Body', bro_split: 'Bro Split', custom: 'Custom'
        };
        return labels[p] || p;
    };

    const formatEmphasis = (arr) => {
        if (!arr || arr.length === 0) return 'Training';
        const labels = {
            chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
            quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
            cardio: 'Cardio', rest: 'Rest'
        };
        return arr.map(e => labels[e] || e).join(' & ');
    };

    const buildDisplay = (pattern, emphasis, label) => {
        const parts = [];
        if (pattern) parts.push(formatPattern(pattern));
        parts.push(formatEmphasis(emphasis));
        if (label) parts.push(label);
        return parts.join(' · ');
    };

    // Get pending requests (people who want to be friends with me)
    const pendingResult = await query(
        `SELECT 
       u.id,
       u.name,
       u.avatar_url,
       f.created_at as requested_at
     FROM friendships f
     JOIN users u ON f.user_id = u.id
     WHERE f.friend_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
        [userId]
    );

    // Get sent requests (people I've requested)
    const sentResult = await query(
        `SELECT 
       u.id,
       u.name,
       u.avatar_url,
       f.created_at as requested_at
     FROM friendships f
     JOIN users u ON f.friend_id = u.id
     WHERE f.user_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
        [userId]
    );

    res.json({
        friends: friendsResult.rows.map(f => {
            let today_intent = null;
            if (f.emphasis || f.muscle_group) {
                // Handle new and legacy data
                const emphasis = f.emphasis || (f.muscle_group ? [f.muscle_group] : []);
                today_intent = {
                    training_pattern: f.split_type,
                    emphasis: emphasis,
                    session_label: f.session_label,
                    display: buildDisplay(f.split_type, emphasis, f.session_label)
                };
            }

            return {
                id: f.id,
                name: f.name,
                avatar_url: f.avatar_url,
                xp_points: f.xp_points || 0,
                today_intent,
                checked_in_today: !!f.last_checkin,
                shares_logs: f.share_logs_default,
                streak: parseInt(f.streak) || 0,
                last_workout_date: f.last_workout_date || null,
                last_workout_type: f.last_workout_type || null,
                worked_out_today: f.worked_out_today || false,
                logged_food_today: f.logged_food_today || false,
            };
        }),
        pending_requests: pendingResult.rows,
        sent_requests: sentResult.rows
    });
}));

/**
 * POST /api/friends/request
 * Send a friend request
 */
router.post('/request', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { friend_id } = req.body;

    if (!friend_id) {
        throw new ValidationError('Please select a user to add');
    }

    if (friend_id === userId) {
        throw new ValidationError("You can't add yourself as a buddy");
    }

    // Check if user exists and is in same gym
    const userResult = await query(
        'SELECT id, name, gym_id FROM users WHERE id = $1',
        [friend_id]
    );

    if (userResult.rows.length === 0) {
        throw new NotFoundError("User not found");
    }

    // Check if already friends or pending
    const existingResult = await query(
        `SELECT status FROM friendships 
     WHERE user_id = $1 AND friend_id = $2`,
        [userId, friend_id]
    );

    if (existingResult.rows.length > 0) {
        const status = existingResult.rows[0].status;
        if (status === 'accepted') {
            throw new ConflictError("You're already gym buddies!");
        }
        if (status === 'pending') {
            throw new ConflictError("Friend request already sent");
        }
    }

    // Check if there's a pending request from them to me
    const reverseResult = await query(
        `SELECT id FROM friendships 
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
        [friend_id, userId]
    );

    if (reverseResult.rows.length > 0) {
        // Auto-accept since both want to be friends
        await query(
            `UPDATE friendships SET status = 'accepted', updated_at = NOW() 
       WHERE user_id = $1 AND friend_id = $2`,
            [friend_id, userId]
        );

        // Create reverse friendship
        await query(
            `INSERT INTO friendships (user_id, friend_id, status) 
       VALUES ($1, $2, 'accepted')`,
            [userId, friend_id]
        );

        return res.json({
            message: "You're now gym buddies! 🎉",
            status: 'accepted'
        });
    }

    // Create pending request
    await query(
        `INSERT INTO friendships (user_id, friend_id, status) 
     VALUES ($1, $2, 'pending')`,
        [userId, friend_id]
    );

    // Notify recipient of friend request (fire-and-forget)
    const senderName = (await query(`SELECT name FROM users WHERE id = $1`, [userId])).rows[0]?.name || 'Someone';
    pushNotifications.sendToUser(friend_id, {
        type: pushNotifications.NotificationType.FRIEND_ACTIVITY,
        title: 'New Friend Request',
        body: `${senderName} wants to be your gym buddy!`,
        data: { screen: 'friends', fromUserId: userId },
    }).catch(() => {});

    res.status(201).json({
        message: 'Friend request sent!',
        status: 'pending'
    });
}));

/**
 * POST /api/friends/accept
 * Accept a friend request
 */
router.post('/accept', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { friend_id } = req.body;

    if (!friend_id) {
        throw new ValidationError('Invalid request');
    }

    // Check if there's a pending request
    const requestResult = await query(
        `SELECT id FROM friendships 
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
        [friend_id, userId]
    );

    if (requestResult.rows.length === 0) {
        throw new NotFoundError("No pending request found");
    }

    // Update to accepted
    await query(
        `UPDATE friendships SET status = 'accepted', updated_at = NOW() 
     WHERE user_id = $1 AND friend_id = $2`,
        [friend_id, userId]
    );

    // Create reverse friendship
    await query(
        `INSERT INTO friendships (user_id, friend_id, status)
     VALUES ($1, $2, 'accepted')
     ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted', updated_at = NOW()`,
        [userId, friend_id]
    );

    // Notify the original requester that their request was accepted
    const acceptorName = (await query(`SELECT name FROM users WHERE id = $1`, [userId])).rows[0]?.name || 'Someone';
    pushNotifications.sendToUser(friend_id, {
        type: pushNotifications.NotificationType.FRIEND_ACTIVITY,
        title: 'Friend Request Accepted!',
        body: `${acceptorName} is now your gym buddy!`,
        data: { screen: 'friends', fromUserId: userId },
    }).catch(() => {});

    res.json({
        message: "You're now gym buddies! 🎉",
        status: 'accepted'
    });
}));

/**
 * POST /api/friends/reject
 * Reject a friend request
 */
router.post('/reject', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { friend_id } = req.body;

    if (!friend_id) {
        throw new ValidationError('Invalid request');
    }

    await query(
        `UPDATE friendships SET status = 'rejected', updated_at = NOW() 
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
        [friend_id, userId]
    );

    res.json({
        message: 'Request declined'
    });
}));

/**
 * DELETE /api/friends/:id
 * Remove a friend
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const friendId = req.params.id;

    // Remove both friendship records
    await query(
        `DELETE FROM friendships 
     WHERE (user_id = $1 AND friend_id = $2) 
        OR (user_id = $2 AND friend_id = $1)`,
        [userId, friendId]
    );

    res.json({
        message: 'Removed from gym buddies'
    });
}));

/**
 * GET /api/friends/:id/status
 * Get friendship status with a specific user
 */
router.get('/:id/status', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const targetId = req.params.id;

    // Check friendship in both directions
    const result = await query(
        `SELECT status, user_id, friend_id FROM friendships
         WHERE (user_id = $1 AND friend_id = $2)
            OR (user_id = $2 AND friend_id = $1)
         LIMIT 1`,
        [userId, targetId]
    );

    if (result.rows.length === 0) {
        return res.json({ status: 'none' });
    }

    const row = result.rows[0];
    if (row.status === 'accepted') {
        return res.json({ status: 'friend' });
    }
    if (row.status === 'blocked') {
        return res.json({ status: 'blocked' });
    }
    if (row.status === 'pending') {
        if (row.user_id === userId) {
            return res.json({ status: 'pending_sent' });
        }
        return res.json({ status: 'pending_received' });
    }

    res.json({ status: 'none' });
}));

/**
 * POST /api/friends/:id/block
 * Block a user (removes friendship if exists)
 */
router.post('/:id/block', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const targetId = req.params.id;

    if (targetId === userId) {
        throw new ValidationError("You can't block yourself");
    }

    // Remove any existing friendship records
    await query(
        `DELETE FROM friendships
         WHERE (user_id = $1 AND friend_id = $2)
            OR (user_id = $2 AND friend_id = $1)`,
        [userId, targetId]
    );

    // Create a blocked record
    await query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'blocked')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'blocked', updated_at = NOW()`,
        [userId, targetId]
    );

    res.json({ message: 'User blocked' });
}));

/**
 * GET /api/friends/search
 * Search for users to add as friends
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;
    const { q } = req.query;

    if (!q || q.length < 2) {
        return res.json({ users: [] });
    }

    // Query supporting both Name search and Username search
    let queryText = '';
    let queryParams = [];

    // Search by exact username
    if (q.startsWith('@')) {
        queryText = `
            SELECT u.id, u.name, u.username, u.avatar_url,
            CASE 
              WHEN f.status = 'accepted' THEN 'friend'
              WHEN f.status = 'pending' AND f.user_id = $1 THEN 'pending_sent'
              WHEN f.status = 'pending' AND f.friend_id = $1 THEN 'pending_received'
              ELSE 'none'
            END as friendship_status
            FROM users u
            LEFT JOIN friendships f ON (
              (f.user_id = $1 AND f.friend_id = u.id)
              OR (f.friend_id = $1 AND f.user_id = u.id)
            )
            WHERE u.username = $2 AND u.id != $1
        `;
        queryParams = [userId, q.substring(1).toLowerCase()];
    } else {
        // Search by name
        queryText = `
            SELECT u.id, u.name, u.username, u.avatar_url,
            CASE 
              WHEN f.status = 'accepted' THEN 'friend'
              WHEN f.status = 'pending' AND f.user_id = $1 THEN 'pending_sent'
              WHEN f.status = 'pending' AND f.friend_id = $1 THEN 'pending_received'
              ELSE 'none'
            END as friendship_status
            FROM users u
            LEFT JOIN friendships f ON (
              (f.user_id = $1 AND f.friend_id = u.id)
              OR (f.friend_id = $1 AND f.user_id = u.id)
            )
            WHERE u.gym_id = $2 
              AND u.id != $1
              AND u.role = 'member'
              AND (u.name ILIKE $3 OR u.username ILIKE $3)
            LIMIT 20
        `;
        queryParams = [userId, gymId, `%${q}%`];
    }

    const result = await query(queryText, queryParams);

    res.json({
        users: result.rows
    });
}));

/**
 * GET /api/friends/suggested
 * Get suggested friends (people in same gym, not yet friends)
 */
router.get('/suggested', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;
    const limit = parseInt(req.query.limit) || 5;

    // Find users in same gym who are NOT my friends and NOT me
    // Also excluding pending requests
    const result = await query(
        `SELECT u.id, u.name, u.avatar_url, u.xp_points,
                a.checked_in_at as last_checkin
         FROM users u
         LEFT JOIN friendships f ON (
             (f.user_id = $1 AND f.friend_id = u.id)
             OR (f.friend_id = $1 AND f.user_id = u.id)
         )
         LEFT JOIN attendances a ON (
             u.id = a.user_id 
             AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
         )
         WHERE u.gym_id = $2 
           AND u.id != $1
           AND u.role = 'member'
           AND f.id IS NULL -- No existing friendship relation
         ORDER BY a.checked_in_at DESC NULLS LAST, RANDOM()
         LIMIT $3`,
        [userId, gymId, limit]
    );

    res.json({
        suggested: result.rows
    });
}));

// In-memory nudge rate limiter (resets on server restart, which is fine)
const nudgeCooldowns = new Map();

/**
 * POST /api/friends/:id/nudge
 * Send a motivational push notification to a friend
 * Rate-limited: one nudge per friend per 24 hours
 */
router.post('/:id/nudge', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const friendId = req.params.id;

    // Verify friendship exists
    const friendshipResult = await query(
        `SELECT 1 FROM friendships
         WHERE user_id = $1 AND friend_id = $2 AND status = 'accepted'`,
        [userId, friendId]
    );

    if (friendshipResult.rows.length === 0) {
        throw new NotFoundError('Friend not found');
    }

    // Rate limit check
    const cooldownKey = `${userId}:${friendId}`;
    const lastNudge = nudgeCooldowns.get(cooldownKey);
    if (lastNudge && Date.now() - lastNudge < 24 * 60 * 60 * 1000) {
        throw new ConflictError("You've already nudged this friend today");
    }

    // Get sender name
    const senderName = (await query(`SELECT name FROM users WHERE id = $1`, [userId])).rows[0]?.name || 'Someone';

    // Send push notification
    await pushNotifications.sendToUser(friendId, {
        type: pushNotifications.NotificationType.FRIEND_ACTIVITY,
        title: 'Buddy Nudge!',
        body: `${senderName} is wondering where you are! 💪`,
        data: { screen: 'home', fromUserId: userId },
    });

    // Record cooldown
    nudgeCooldowns.set(cooldownKey, Date.now());

    res.json({ message: 'Nudge sent!' });
}));

module.exports = router;
