const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { NotFoundError, asyncHandler } = require('../utils/errors');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/buddy-activity/:id
 * Get friend's activity for today (workouts, food, intent)
 * Only returns data if:
 * 1. They are accepted friends
 * 2. Friend has sharing enabled OR log visibility is public
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const friendId = req.params.id;

    // Check if they are accepted friends
    const friendshipResult = await query(
        `SELECT status FROM friendships
         WHERE (user_id = $1 AND friend_id = $2)
            OR (user_id = $2 AND friend_id = $1)
         AND status = 'accepted'`,
        [userId, friendId]
    );

    if (friendshipResult.rows.length === 0) {
        return res.status(403).json({
            can_view: false,
            blocked_reason: 'not_friend',
            message: 'You are not friends with this user'
        });
    }

    // Get friend's basic info and sharing preference
    const friendResult = await query(
        `SELECT id, name, avatar_url, xp_points, share_logs_default
         FROM users
         WHERE id = $1`,
        [friendId]
    );

    if (friendResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    const friend = friendResult.rows[0];
    const friendSharesLogs = friend.share_logs_default;

    // Get friend's today's workout intent
    const intentResult = await query(
        `SELECT split_type, emphasis, session_label
         FROM workout_intents
         WHERE user_id = $1
           AND expires_at > NOW()
           AND visibility IN ('public', 'friends')`,
        [friendId]
    );

    // Get friend's workout logs for today
    const workoutResult = await query(
        `SELECT id, workout_type, exercises, notes, visibility, created_at
         FROM workout_logs
         WHERE user_id = $1
           AND logged_date = CURRENT_DATE
           AND (
             visibility = 'public'
             OR (visibility = 'friends' AND ($2 = true))
             OR visibility = 'private' AND false  -- Never show private logs
           )
         ORDER BY created_at DESC`,
        [friendId, friendSharesLogs]
    );

    // Get friend's food logs for today
    const foodResult = await query(
        `SELECT id, meal_name, calories, protein, carbs, fat, visibility, created_at
         FROM calorie_logs
         WHERE user_id = $1
           AND logged_date = CURRENT_DATE
           AND (
             visibility = 'public'
             OR (visibility = 'friends' AND ($2 = true))
             OR visibility = 'private' AND false  -- Never show private logs
           )
         ORDER BY created_at DESC`,
        [friendId, friendSharesLogs]
    );

    // Get food summary for today
    const foodSummaryResult = await query(
        `SELECT
           SUM(calories) as total_calories,
           SUM(protein) as total_protein,
           SUM(carbs) as total_carbs,
           SUM(fat) as total_fat,
           COUNT(*) as meal_count
         FROM calorie_logs
         WHERE user_id = $1
           AND logged_date = CURRENT_DATE
           AND (
             visibility = 'public'
             OR (visibility = 'friends' AND ($2 = true))
             OR visibility = 'private' AND false
           )`,
        [friendId, friendSharesLogs]
    );

    // Get check-in status for today
    const checkinResult = await query(
        `SELECT checked_in_at
         FROM attendances
         WHERE user_id = $1
           AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
         ORDER BY checked_in_at DESC
         LIMIT 1`,
        [friendId]
    );

    // Format intent display
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
        if (!arr || arr.length === 0) return null;
        const labels = {
            chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
            quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
            cardio: 'Cardio', rest: 'Rest'
        };
        return arr.map(e => labels[e] || e).join(' & ');
    };

    const intent = intentResult.rows[0];
    let todayIntent = null;
    if (intent) {
        const emphasis = intent.emphasis || [];
        const parts = [];
        if (intent.split_type) parts.push(formatPattern(intent.split_type));
        if (emphasis.length > 0) parts.push(formatEmphasis(emphasis));
        if (intent.session_label) parts.push(intent.session_label);
        todayIntent = {
            training_pattern: intent.split_type,
            emphasis: emphasis,
            session_label: intent.session_label,
            display: parts.join(' · ')
        };
    }

    // Determine if user can view logs
    const canViewLogs = friendSharesLogs || workoutResult.rows.length > 0 || foodResult.rows.length > 0;

    res.json({
        can_view: canViewLogs,
        blocked_reason: canViewLogs ? null : 'logs_private',
        friend: {
            id: friend.id,
            name: friend.name,
            avatar_url: friend.avatar_url,
            xp_points: friend.xp_points,
            shares_logs_by_default: friendSharesLogs
        },
        today: {
            intent: todayIntent,
            workouts: workoutResult.rows.map(w => ({
                id: w.id,
                type: w.workout_type,
                exercises: w.exercises,
                notes: w.notes,
                logged_at: w.created_at
            })),
            food: {
                total_calories: foodSummaryResult.rows[0].total_calories || 0,
                total_protein: foodSummaryResult.rows[0].total_protein || 0,
                total_carbs: foodSummaryResult.rows[0].total_carbs || 0,
                total_fat: foodSummaryResult.rows[0].total_fat || 0,
                meals: foodResult.rows.map(f => ({
                    id: f.id,
                    name: f.meal_name,
                    calories: f.calories,
                    protein: f.protein,
                    carbs: f.carbs,
                    fat: f.fat,
                    logged_at: f.created_at
                }))
            },
            checked_in: checkinResult.rows.length > 0,
            checked_in_at: checkinResult.rows[0]?.checked_in_at || null
        }
    });
}));

module.exports = router;
