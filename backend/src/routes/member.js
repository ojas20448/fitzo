const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, invalidateUserCache } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');
const cache = require('../services/cache');

// Helper functions for intent display formatting
const formatPattern = (p) => {
    if (!p) return null;
    const labels = {
        push: 'Push', pull: 'Pull', legs: 'Legs',
        upper: 'Upper', lower: 'Lower',
        anterior: 'Anterior', posterior: 'Posterior',
        full_body: 'Full Body', bro_split: 'Bro Split', custom: 'Custom',
        anterior_posterior: 'Ant/Post', ppl: 'PPL', upper_lower: 'Upper/Lower',
        push_pull: 'Push/Pull', arnold_split: 'Arnold', phul: 'PHUL', phat: 'PHAT'
    };
    return labels[p] || p;
};

const formatEmphasis = (arr) => {
    if (!arr || arr.length === 0) return 'Training';
    const labels = {
        chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
        quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
        cardio: 'Cardio', rest: 'Rest',
        push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower',
        full_body: 'Full Body', 'full body': 'Full Body',
        anterior: 'Anterior', posterior: 'Posterior',
        'full body a': 'Full Body A', 'full body b': 'Full Body B', 'full body c': 'Full Body C'
    };
    return arr.map(e => labels[e] || e.charAt(0).toUpperCase() + e.slice(1)).join(' & ');
};

const buildDisplay = (pattern, emphasis, label) => {
    const parts = [];
    if (pattern) parts.push(formatPattern(pattern));
    parts.push(formatEmphasis(emphasis));
    if (label) parts.push(label);
    return parts.join(' · ');
};

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

    // Run ALL queries in parallel for speed (was sequential — 8 round trips → 1)
    const [
        checkinResult,
        intentResult,
        crowdData,
        gymResult,
        streakVal,
        historyResult,
        userResult,
        learnResult,
    ] = await Promise.all([
        // 1. Check-in status
        query(
            `SELECT id, checked_in_at FROM attendances
             WHERE user_id = $1 AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
            [userId]
        ).catch(err => { console.error('❌ checkin:', err.message); return { rows: [] }; }),

        // 2. Today's intent
        query(
            `SELECT * FROM workout_intents WHERE user_id = $1 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        ).catch(err => { console.error('❌ intent:', err.message); return { rows: [] }; }),

        // 3. Crowd level (cached)
        cache.getOrSet(
            cache.keys.crowdLevel(gymId),
            async () => {
                const r = await query(
                    `SELECT COUNT(*) as count FROM attendances
                     WHERE gym_id = $1 AND checked_in_at > NOW() - INTERVAL '60 minutes'`,
                    [gymId]
                );
                const count = parseInt(r.rows[0].count) || 0;
                return { count, level: count >= 40 ? 'high' : count >= 20 ? 'medium' : 'low' };
            },
            cache.TTL.CROWD_LEVEL
        ).catch(() => ({ count: 0, level: 'low' })),

        // 4. Gym name
        query(`SELECT name FROM gyms WHERE id = $1`, [gymId])
            .catch(() => ({ rows: [] })),

        // 5. Streak (cached)
        cache.getOrSet(
            cache.keys.userStreak(userId),
            async () => {
                const r = await query(`SELECT get_user_streak($1) as streak`, [userId]);
                return parseInt(r.rows[0].streak) || 0;
            },
            cache.TTL.USER_STREAK
        ).catch(() => 0),

        // 6. Check-in history
        query(
            `SELECT DISTINCT DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') as checkin_date
             FROM attendances WHERE user_id = $1
             AND checked_in_at >= DATE_TRUNC('month', CURRENT_DATE)
             AND checked_in_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
            [userId]
        ).catch(() => ({ rows: [] })),

        // 7. User info
        query(`SELECT name, xp_points, avatar_url FROM users WHERE id = $1`, [userId])
            .catch(() => ({ rows: [] })),

        // 8. Learning progress
        query(
            `SELECT l.id, l.title, l.unit, l.unit_title, l.order_index,
                    CASE WHEN la.completed THEN true ELSE false END as completed
             FROM learn_lessons l
             LEFT JOIN (
                SELECT DISTINCT ON (lesson_id) lesson_id, completed
                FROM learn_attempts WHERE user_id = $1
                ORDER BY lesson_id, attempted_at DESC
             ) la ON l.id = la.lesson_id
             WHERE NOT COALESCE(la.completed, false)
             ORDER BY l.unit, l.order_index LIMIT 1`,
            [userId]
        ).catch(() => ({ rows: [] })),
    ]);

    // Process results
    const isCheckedIn = checkinResult.rows.length > 0;
    const checkinTime = isCheckedIn ? checkinResult.rows[0].checked_in_at : null;

    let intent = null;
    if (intentResult.rows.length > 0) {
        const row = intentResult.rows[0];
        const pattern = row.split_type || row.muscle_group;
        const emphasis = row.emphasis || [];
        const label = row.session_label || '';
        intent = {
            id: row.id, training_pattern: pattern, emphasis, session_label: label,
            display: buildDisplay(pattern, emphasis, label),
            visibility: row.visibility, note: row.note
        };
    }

    const crowdCount = crowdData.count;
    const crowdLevel = crowdData.level;
    const gymName = gymResult.rows.length > 0 ? gymResult.rows[0].name : 'Your Gym';
    const streak = streakVal;
    const history = historyResult.rows.map(r => r.checkin_date);
    const user = userResult.rows.length > 0 ? userResult.rows[0] : { name: 'Member', xp_points: 0, avatar_url: null };

    // Learning progress (needs a follow-up query for unit %)
    let learn = null;
    if (learnResult.rows.length > 0) {
        const lesson = learnResult.rows[0];
        try {
            const unitProgress = await query(
                `SELECT COUNT(*) FILTER (WHERE COALESCE(la.completed, false)) as completed_count,
                        COUNT(*) as total_count
                 FROM learn_lessons l
                 LEFT JOIN (
                    SELECT DISTINCT ON (lesson_id) lesson_id, completed
                    FROM learn_attempts WHERE user_id = $1
                    ORDER BY lesson_id, attempted_at DESC
                 ) la ON l.id = la.lesson_id
                 WHERE l.unit = $2`,
                [userId, lesson.unit]
            );
            const p = unitProgress.rows[0];
            learn = {
                title: lesson.unit_title, lesson: `Lesson ${lesson.order_index}`,
                topic: lesson.title, progress: Math.round((p.completed_count / p.total_count) * 100)
            };
        } catch {}
    }

    // Verbose response logging removed for production

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
        learn,
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

    // Invalidate cached auth data so next request picks up new name/avatar
    await invalidateUserCache(userId);

    res.json({
        success: true,
        user: result.rows[0]
    });
}));

module.exports = router;
