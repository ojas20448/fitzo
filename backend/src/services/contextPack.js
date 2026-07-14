const { query } = require('../config/database');
const cache = require('./cache');

/**
 * Compiles a rich 14-day context pack for the user.
 * Includes profiles, check-in streaks, training volume/PRs, nutrition totals vs target,
 * daily readiness indicators, weight trend, and active workout split / today's intent.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Context pack JSON object
 */
async function buildContextPack(userId) {
    // 1. Fetch User Profile
    const profileResult = await query(
        `SELECT goal_type, current_weight, target_weight, height, age, gender, activity_level, target_calories, ai_profile_summary
         FROM fitness_profiles WHERE user_id = $1`,
        [userId]
    );
    const profile = profileResult.rows[0] || null;

    // 2. Fetch Check-in Streak
    const streakResult = await query(`SELECT get_user_streak($1) as streak`, [userId]);
    const streak = streakResult.rows[0]?.streak || 0;

    // 3. Fetch Last 14 Days Check-ins
    const attendanceResult = await query(
        `SELECT check_date, checked_in_at
         FROM attendances
         WHERE user_id = $1 AND check_date >= CURRENT_DATE - INTERVAL '14 days'
         ORDER BY check_date DESC`,
        [userId]
    );
    const attendances = attendanceResult.rows;

    // 4. Fetch Last 14 Days Workout History
    const sessionsResult = await query(
        `SELECT s.id, s.day_name, s.completed_at, s.duration_minutes, s.notes,
                el.id as log_id, COALESCE(e.name, el.custom_exercise_name) as exercise_name, e.category as exercise_category,
                sl.set_number, sl.reps, sl.weight_kg, sl.rpe
         FROM workout_sessions s
         LEFT JOIN exercise_logs el ON el.session_id = s.id
         LEFT JOIN exercises e ON el.exercise_id = e.id
         LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id
         WHERE s.user_id = $1 AND s.completed_at >= NOW() - INTERVAL '14 days'
         ORDER BY s.completed_at DESC, el.order_index ASC, sl.set_number ASC`,
        [userId]
    );

    const sessionsMap = {};
    const categorySets = {};
    const prs = {};

    for (const row of sessionsResult.rows) {
        if (!row.id) continue;
        
        if (!sessionsMap[row.id]) {
            sessionsMap[row.id] = {
                id: row.id,
                day_name: row.day_name,
                completed_at: row.completed_at,
                duration_minutes: row.duration_minutes,
                notes: row.notes,
                exercises: {}
            };
        }
        
        if (row.log_id && row.exercise_name) {
            if (!sessionsMap[row.id].exercises[row.log_id]) {
                sessionsMap[row.id].exercises[row.log_id] = {
                    name: row.exercise_name,
                    category: row.exercise_category || 'other',
                    sets: []
                };
            }
            
            if (row.set_number != null) {
                sessionsMap[row.id].exercises[row.log_id].sets.push({
                    set_number: row.set_number,
                    reps: row.reps,
                    weight_kg: parseFloat(row.weight_kg) || 0,
                    rpe: row.rpe
                });

                // Count total sets completed per muscle group
                const category = row.exercise_category || 'other';
                categorySets[category] = (categorySets[category] || 0) + 1;

                // Track Personal Records (max weight)
                const weight = parseFloat(row.weight_kg) || 0;
                if (weight > 0) {
                    if (!prs[row.exercise_name] || weight > prs[row.exercise_name]) {
                        prs[row.exercise_name] = weight;
                    }
                }
            }
        }
    }

    const sessions = Object.values(sessionsMap).map(s => ({
        ...s,
        exercises: Object.values(s.exercises)
    }));

    const ALL_CATEGORIES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    const skippedMuscleGroups = ALL_CATEGORIES.filter(cat => !categorySets[cat] || categorySets[cat] === 0);

    // 5. Fetch Last 14 Days Nutrition
    const nutritionResult = await query(
        `SELECT logged_date, SUM(calories)::int as calories, SUM(protein)::int as protein,
                SUM(carbs)::int as carbs, SUM(fat)::int as fat,
                ARRAY_AGG(meal_name) as meals
         FROM calorie_logs
         WHERE user_id = $1 AND logged_date >= CURRENT_DATE - INTERVAL '14 days'
         GROUP BY logged_date
         ORDER BY logged_date DESC`,
        [userId]
    );

    // 6. Fetch Last 14 Days Readiness
    const readinessResult = await query(
        `SELECT log_date, energy_level, sleep_quality, soreness, sleep_hours, readiness_score, recommendation
         FROM readiness_logs
         WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '14 days'
         ORDER BY log_date DESC`,
        [userId]
    );

    // 7. Fetch Last 14 Days Weight History
    const weightResult = await query(
        `SELECT recorded_at::date as log_date, weight, body_fat
         FROM body_measurements
         WHERE user_id = $1 AND weight IS NOT NULL AND recorded_at >= NOW() - INTERVAL '14 days'
         ORDER BY recorded_at DESC`,
        [userId]
    );

    // 8. Fetch Active Split
    const splitResult = await query(
        `SELECT split_id, name, days, days_per_week
         FROM user_splits
         WHERE user_id = $1 AND is_active = true
         LIMIT 1`,
        [userId]
    );
    const activeSplit = splitResult.rows[0] || null;

    // 9. Fetch Today's Intent
    const intentResult = await query(
        `SELECT muscle_group, note, session_label, created_at
         FROM workout_intents
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );
    const todayIntent = intentResult.rows[0] || null;

    return {
        userId,
        profile,
        streak,
        attendances,
        training: {
            sessions,
            volume: categorySets,
            prs,
            skippedMuscleGroups
        },
        nutrition: nutritionResult.rows,
        readiness: readinessResult.rows,
        weightHistory: weightResult.rows,
        activeSplit,
        todayIntent
    };
}

/**
 * Gets a cached version of the user's Context Pack.
 * TTL is 15 minutes (900 seconds) to balance DB load and freshness.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Context pack JSON object
 */
async function getContextPack(userId) {
    const cacheKey = `user:${userId}:context_pack`;
    return cache.getOrSet(cacheKey, () => buildContextPack(userId), 900);
}

/**
 * Invalidates the cached Context Pack for a user (called after new logs/intents).
 *
 * @param {string} userId - User UUID
 */
async function invalidateContextPack(userId) {
    const cacheKey = `user:${userId}:context_pack`;
    await cache.del(cacheKey);
}

module.exports = {
    getContextPack,
    invalidateContextPack
};
