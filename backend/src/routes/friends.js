const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, ConflictError, NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * GET /api/friends
 * List all friends and pending requests
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get accepted friends with their today's intent
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
       a.checked_in_at as last_checkin
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
                shares_logs: f.share_logs_default
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

module.exports = router;
