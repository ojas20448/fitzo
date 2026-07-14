const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');
const { getStartOfWeek } = require('../services/weeklyRecap');
const pushNotifications = require('../services/pushNotifications');

router.use(authenticate);

/**
 * GET /api/leaderboard
 * Get the weekly XP leaderboard for the user's gym
 */
router.get('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;

    if (!gymId) {
        return res.json({ success: true, leaderboard: [] });
    }

    const startOfWeek = getStartOfWeek();

    // Query leaderboard: ranks users in the same gym by XP earned since the start of this week
    const leaderboardResult = await query(
        `SELECT u.id, u.name, u.avatar_url,
                COALESCE(SUM(x.amount), 0)::int as weekly_xp,
                (SELECT COUNT(*)::int FROM kudos k WHERE k.receiver_id = u.id AND k.week_start_date = $2) as kudos_count,
                EXISTS(SELECT 1 FROM kudos k WHERE k.sender_id = $3 AND k.receiver_id = u.id AND k.week_start_date = $2) as has_kudoed
         FROM users u
         LEFT JOIN xp_logs x ON u.id = x.user_id AND x.created_at >= $2
         WHERE u.gym_id = $1
         GROUP BY u.id, u.name, u.avatar_url
         ORDER BY weekly_xp DESC, u.name ASC`,
        [gymId, startOfWeek, userId]
    );

    res.json({ success: true, leaderboard: leaderboardResult.rows });
}));

/**
 * POST /api/leaderboard/kudos
 * Give kudos fist-bump to a gym buddy for this week
 */
router.post('/kudos', asyncHandler(async (req, res) => {
    const senderId = req.user.id;
    const senderName = req.user.name;
    const { receiverId } = req.body;

    if (!receiverId) {
        throw new ValidationError('Receiver ID is required');
    }

    if (senderId === receiverId) {
        throw new ValidationError('You cannot give kudos to yourself');
    }

    // Verify receiver belongs to the same gym
    const receiverResult = await query(
        'SELECT gym_id, name FROM users WHERE id = $1',
        [receiverId]
    );

    if (receiverResult.rows.length === 0) {
        throw new NotFoundError('Receiver member not found');
    }

    const receiver = receiverResult.rows[0];
    if (receiver.gym_id !== req.user.gym_id) {
        throw new ValidationError('Receiver is not in your gym');
    }

    const startOfWeek = getStartOfWeek();

    try {
        await query(
            `INSERT INTO kudos (sender_id, receiver_id, week_start_date)
             VALUES ($1, $2, $3)`,
            [senderId, receiverId, startOfWeek]
        );

        // Send push notification to receiver
        await pushNotifications.sendToUser(receiverId, {
            title: 'Kudos fist-bump! 👊',
            body: `${senderName} gave you a Kudos fist-bump for your consistency this week!`,
            type: 'friend_activity'
        });

        res.json({ success: true, message: `You sent a Kudos fist-bump to ${receiver.name}!` });
    } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'You have already kudoed this buddy this week!' });
        }
        console.error('Error sending kudos:', err.message);
        throw err;
    }
}));

module.exports = router;
