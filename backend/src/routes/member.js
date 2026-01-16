const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

/**
 * GET /api/member/home
 * Main home screen API - returns all data needed for member dashboard
 * 
 * Returns:
 * - User info
 * - Check-in status for today
 * - Today's workout intent
 * - Crowd indicator (green/orange/red)
 * - Current streak count
 */
router.get('/home', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;

    // Get today's check-in status
    const checkinResult = await query(
        `SELECT id, checked_in_at 
     FROM attendances 
     WHERE user_id = $1 
     AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
        [userId]
    );

    const isCheckedIn = checkinResult.rows.length > 0;
    const checkinTime = isCheckedIn ? checkinResult.rows[0].checked_in_at : null;

    // Get today's workout intent
    const intentResult = await query(
        `SELECT id, split_type, emphasis, session_label, visibility, note, expires_at 
         FROM workout_intents 
         WHERE user_id = $1 
         AND expires_at > NOW()
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
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

    const intent = intentResult.rows.length > 0 ? {
        id: intentResult.rows[0].id,
        training_pattern: intentResult.rows[0].split_type,
        emphasis: intentResult.rows[0].emphasis || [],
        session_label: intentResult.rows[0].session_label,
        display: buildDisplay(intentResult.rows[0].split_type, intentResult.rows[0].emphasis, intentResult.rows[0].session_label),
        visibility: intentResult.rows[0].visibility,
        note: intentResult.rows[0].note
    } : null;

    // Get crowd level (check-ins in last 60 minutes)
    const crowdResult = await query(
        `SELECT COUNT(*) as count 
         FROM attendances 
         WHERE gym_id = $1 
         AND checked_in_at > NOW() - INTERVAL '60 minutes'`,
        [gymId]
    );

    const crowdCount = parseInt(crowdResult.rows[0].count);
    let crowdLevel = 'low';
    if (crowdCount >= 40) crowdLevel = 'high';
    else if (crowdCount >= 20) crowdLevel = 'medium';

    // Get gym name
    const gymResult = await query(
        `SELECT name FROM gyms WHERE id = $1`,
        [gymId]
    );

    const gymName = gymResult.rows.length > 0 ? gymResult.rows[0].name : 'Your Gym';

    // Get streak count (consecutive days of check-in including today)
    const streakResult = await query(
        `SELECT get_user_streak($1) as streak`,
        [userId]
    );

    const streak = parseInt(streakResult.rows[0].streak) || 0;

    // Get current month's check-in history
    const historyResult = await query(
        `SELECT DISTINCT DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') as checkin_date
         FROM attendances
         WHERE user_id = $1
         AND checked_in_at >= DATE_TRUNC('month', CURRENT_DATE)
         AND checked_in_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
        [userId]
    );

    const history = historyResult.rows.map(r => r.checkin_date);

    // Get user's XP and name
    const userResult = await query(
        `SELECT name, xp_points, avatar_url FROM users WHERE id = $1`,
        [userId]
    );

    const user = userResult.rows[0];

    res.json({
        user: {
            name: user.name,
            avatar_url: user.avatar_url,
            xp_points: user.xp_points || 0
        },
        checkin: {
            status: isCheckedIn ? 'checked_in' : 'not_checked_in',
            checked_in_at: checkinTime
        },
        intent,
        crowd: {
            level: crowdLevel,
            count: crowdCount
        },
        streak: {
            current: streak,
            best: streak,
            history: history
        },
        insight: await generateInsight(userId, streak)
    });
}));

// Helper to generate smart insights
async function generateInsight(userId, streak) {
    // 1. Check protein consistency (last 3 days)
    const proteinResult = await query(
        `SELECT AVG(protein) as avg_protein 
         FROM calorie_logs 
         WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '3 days'`,
        [userId]
    );
    const avgProtein = parseFloat(proteinResult.rows[0].avg_protein) || 0;

    // Get target (mocked for now or fetch from profile)
    // ideally: SELECT target_protein FROM nutrition_profiles WHERE user_id = ...
    const targetProtein = 150;

    if (avgProtein > 0 && avgProtein < targetProtein * 0.7) {
        return {
            type: 'warning',
            message: `Your protein is low this week (${Math.round(avgProtein)}g avg). Hit 150g to fuel recovery! 🥩`
        };
    }

    // 2. Check workout consistency
    if (streak > 2) {
        return {
            type: 'success',
            message: `You're on fire! ${streak} day streak. Keep it up! 🔥`
        };
    }

    return null;
}

module.exports = router;
