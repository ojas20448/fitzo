const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');

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

    // 1. Get today's check-in status
    let isCheckedIn = false;
    let checkinTime = null;
    try {
        const checkinResult = await query(
            `SELECT id, checked_in_at 
             FROM attendances 
             WHERE user_id = $1 
             AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
            [userId]
        );
        isCheckedIn = checkinResult.rows.length > 0;
        checkinTime = isCheckedIn ? checkinResult.rows[0].checked_in_at : null;
    } catch (err) {
        console.error('❌ Error fetching checkin:', err.message);
    }

    // 2. Get today's workout intent
    let intent = null;
    try {
        const intentResult = await query(
            `SELECT * FROM workout_intents 
             WHERE user_id = $1 
             AND expires_at > NOW()
             ORDER BY created_at DESC 
             LIMIT 1`,
            [userId]
        );

        if (intentResult.rows.length > 0) {
            const row = intentResult.rows[0];
            // Handle schema variations (split_type vs muscle_group)
            const pattern = row.split_type || row.muscle_group;
            const emphasis = row.emphasis || [];
            const label = row.session_label || '';

            intent = {
                id: row.id,
                training_pattern: pattern,
                emphasis: emphasis,
                session_label: label,
                display: buildDisplay(pattern, emphasis, label),
                visibility: row.visibility,
                note: row.note
            };
        }
    } catch (err) {
        console.error('❌ Error fetching intent:', err.message);
    }

    // 3. Get crowd level
    let crowdCount = 0;
    let crowdLevel = 'low';
    try {
        const crowdResult = await query(
            `SELECT COUNT(*) as count 
             FROM attendances 
             WHERE gym_id = $1 
             AND checked_in_at > NOW() - INTERVAL '60 minutes'`,
            [gymId]
        );
        crowdCount = parseInt(crowdResult.rows[0].count) || 0;
        if (crowdCount >= 40) crowdLevel = 'high';
        else if (crowdCount >= 20) crowdLevel = 'medium';
    } catch (err) {
        console.error('❌ Error fetching crowd level:', err.message);
    }

    // 4. Get gym name
    let gymName = 'Your Gym';
    try {
        const gymResult = await query(
            `SELECT name FROM gyms WHERE id = $1`,
            [gymId]
        );
        if (gymResult.rows.length > 0) gymName = gymResult.rows[0].name;
    } catch (err) {
        console.error('❌ Error fetching gym name:', err.message);
    }

    // 5. Get streak count
    let streak = 0;
    try {
        const streakResult = await query(
            `SELECT get_user_streak($1) as streak`,
            [userId]
        );
        streak = parseInt(streakResult.rows[0].streak) || 0;
    } catch (err) {
        console.error('❌ Error fetching streak:', err.message);
    }

    // 6. Get check-in history
    let history = [];
    try {
        const historyResult = await query(
            `SELECT DISTINCT DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') as checkin_date
             FROM attendances
             WHERE user_id = $1
             AND checked_in_at >= DATE_TRUNC('month', CURRENT_DATE)
             AND checked_in_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
            [userId]
        );
        history = historyResult.rows.map(r => r.checkin_date);
    } catch (err) {
        console.error('❌ Error fetching history:', err.message);
    }

    // 7. Get user's XP and name
    let user = { name: 'Member', xp_points: 0, avatar_url: null };
    try {
        const userResult = await query(
            `SELECT name, xp_points, avatar_url FROM users WHERE id = $1`,
            [userId]
        );
        if (userResult.rows.length > 0) user = userResult.rows[0];
    } catch (err) {
        console.error('❌ Error fetching user data:', err.message);
    }

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
        gym: {
            name: gymName
        },
        crowd: {
            level: crowdLevel,
            count: crowdCount
        },
        streak: {
            current: streak,
            best: streak,
            history: history
        },
        insight: await safeGenerateInsight(userId, streak)
    });
}));

// Helper to generate smart insights
async function safeGenerateInsight(userId, streak) {
    try {
        // Check protein consistency (last 3 days)
        const proteinResult = await query(
            `SELECT AVG(protein) as avg_protein 
             FROM calorie_logs 
             WHERE user_id = $1 
             AND created_at > NOW() - INTERVAL '3 days'`,
            [userId]
        );
        const avgProtein = parseFloat(proteinResult.rows[0].avg_protein) || 0;

        // Get target from nutrition profile if exists
        let targetProtein = 150;
        try {
            const profileRes = await query(`SELECT target_protein FROM nutrition_profiles WHERE user_id = $1`, [userId]);
            if (profileRes.rows.length > 0) targetProtein = profileRes.rows[0].target_protein;
        } catch (e) {
            // fallback to default
        }

        if (avgProtein > 0 && avgProtein < targetProtein * 0.7) {
            return {
                type: 'warning',
                message: `Your protein is low this week (${Math.round(avgProtein)}g avg). Hit ${targetProtein}g to fuel recovery! 🥩`
            };
        }

        // Check workout consistency
        if (streak > 2) {
            return {
                type: 'success',
                message: `You're on fire! ${streak} day streak. Keep it up! 🔥`
            };
        }
    } catch (err) {
        console.error('❌ Error generating insight:', err.message);
    }

    return null;
}

/**
 * PUT /api/member/profile
 * Update user profile (name, avatar)
 */
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, avatar_url } = req.body;

    if (!name) {
        throw new ValidationError('Name is required');
    }

    const result = await query(
        `UPDATE users 
         SET name = $1, avatar_url = $2, updated_at = NOW() 
         WHERE id = $3 
         RETURNING id, name, email, role, avatar_url, xp_points`,
        [name, avatar_url, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        user: result.rows[0]
    });
}));

module.exports = router;
