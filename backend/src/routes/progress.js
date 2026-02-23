/**
 * Progressive Overload & PR Tracking API
 *
 * Provides:
 * - Personal Records (PRs) per exercise
 * - Volume trends over time
 * - Strength curves per exercise
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

router.use(authenticate);

// ===========================================
// GET ALL-TIME PRs FOR USER
// ===========================================
router.get('/prs', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT
            e.id as exercise_id,
            e.name as exercise_name,
            e.category,
            e.muscle_groups,
            MAX(sl.weight_kg) as max_weight_kg,
            (SELECT sl2.reps FROM set_logs sl2
             JOIN exercise_logs el2 ON sl2.exercise_log_id = el2.id
             JOIN workout_sessions ws2 ON el2.session_id = ws2.id
             WHERE ws2.user_id = $1 AND el2.exercise_id = e.id
               AND sl2.weight_kg = MAX(sl.weight_kg)
             ORDER BY ws2.completed_at DESC LIMIT 1
            ) as reps_at_max,
            MAX(sl.weight_kg * sl.reps) as max_volume_single_set,
            COUNT(DISTINCT ws.id) as times_performed,
            MAX(ws.completed_at) as last_performed
         FROM set_logs sl
         JOIN exercise_logs el ON sl.exercise_log_id = el.id
         JOIN workout_sessions ws ON el.session_id = ws.id
         JOIN exercises e ON el.exercise_id = e.id
         WHERE ws.user_id = $1
           AND ws.completed_at IS NOT NULL
           AND sl.is_warmup = false
         GROUP BY e.id, e.name, e.category, e.muscle_groups
         ORDER BY max_weight_kg DESC`,
        [userId]
    );

    res.json({ prs: result.rows });
}));

// ===========================================
// GET PR HISTORY FOR A SPECIFIC EXERCISE
// ===========================================
router.get('/prs/:exerciseId', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { exerciseId } = req.params;

    // Get all sessions for this exercise with best set per session
    const result = await query(
        `SELECT
            ws.id as session_id,
            ws.completed_at as date,
            MAX(sl.weight_kg) as best_weight,
            MAX(sl.reps) as best_reps,
            MAX(sl.weight_kg * sl.reps) as best_volume_set,
            SUM(sl.weight_kg * sl.reps) as total_volume,
            COUNT(sl.id) as total_sets
         FROM set_logs sl
         JOIN exercise_logs el ON sl.exercise_log_id = el.id
         JOIN workout_sessions ws ON el.session_id = ws.id
         WHERE ws.user_id = $1
           AND el.exercise_id = $2
           AND ws.completed_at IS NOT NULL
           AND sl.is_warmup = false
         GROUP BY ws.id, ws.completed_at
         ORDER BY ws.completed_at ASC`,
        [userId, exerciseId]
    );

    // Calculate running PR (the max weight achieved up to each session)
    let runningMax = 0;
    const history = result.rows.map(row => {
        const isNewPR = parseFloat(row.best_weight) > runningMax;
        if (isNewPR) runningMax = parseFloat(row.best_weight);
        return {
            ...row,
            is_pr: isNewPR,
            running_pr: runningMax,
        };
    });

    res.json({ exercise_id: exerciseId, history });
}));

// ===========================================
// GET VOLUME TRENDS (weekly aggregates)
// ===========================================
router.get('/volume', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { weeks = 8, muscle_group } = req.query;

    let sql = `
        SELECT
            date_trunc('week', ws.completed_at)::date as week_start,
            COALESCE(e.muscle_groups, 'other') as muscle_group,
            SUM(sl.weight_kg * sl.reps) as total_volume,
            COUNT(DISTINCT ws.id) as sessions,
            COUNT(sl.id) as total_sets
        FROM set_logs sl
        JOIN exercise_logs el ON sl.exercise_log_id = el.id
        JOIN workout_sessions ws ON el.session_id = ws.id
        LEFT JOIN exercises e ON el.exercise_id = e.id
        WHERE ws.user_id = $1
          AND ws.completed_at IS NOT NULL
          AND ws.completed_at >= NOW() - ($2::int || ' weeks')::interval
          AND sl.is_warmup = false`;

    const params = [userId, parseInt(weeks)];

    if (muscle_group) {
        params.push(muscle_group);
        sql += ` AND e.muscle_groups ILIKE '%' || $${params.length} || '%'`;
    }

    sql += ` GROUP BY week_start, muscle_group ORDER BY week_start ASC, muscle_group`;

    const result = await query(sql, params);

    // Also compute week-over-week change
    const weeklyTotals = {};
    for (const row of result.rows) {
        const week = row.week_start;
        if (!weeklyTotals[week]) {
            weeklyTotals[week] = { week_start: week, total_volume: 0, sessions: 0, total_sets: 0, by_muscle: {} };
        }
        weeklyTotals[week].total_volume += parseFloat(row.total_volume) || 0;
        weeklyTotals[week].sessions += parseInt(row.sessions);
        weeklyTotals[week].total_sets += parseInt(row.total_sets);
        weeklyTotals[week].by_muscle[row.muscle_group] = parseFloat(row.total_volume) || 0;
    }

    const weeklyArray = Object.values(weeklyTotals);
    for (let i = 1; i < weeklyArray.length; i++) {
        const prev = weeklyArray[i - 1].total_volume;
        const curr = weeklyArray[i].total_volume;
        weeklyArray[i].change_pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
    }

    res.json({
        weeks: weeklyArray,
        detailed: result.rows,
    });
}));

// ===========================================
// GET ESTIMATED 1RM TRENDS FOR AN EXERCISE
// ===========================================
router.get('/strength/:exerciseId', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { exerciseId } = req.params;

    const result = await query(
        `SELECT
            ws.completed_at as date,
            sl.weight_kg,
            sl.reps,
            sl.rpe
         FROM set_logs sl
         JOIN exercise_logs el ON sl.exercise_log_id = el.id
         JOIN workout_sessions ws ON el.session_id = ws.id
         WHERE ws.user_id = $1
           AND el.exercise_id = $2
           AND ws.completed_at IS NOT NULL
           AND sl.is_warmup = false
           AND sl.weight_kg > 0
         ORDER BY ws.completed_at ASC`,
        [userId, exerciseId]
    );

    // Calculate estimated 1RM using Epley formula: weight * (1 + reps/30)
    const dataPoints = result.rows.map(row => {
        const weight = parseFloat(row.weight_kg);
        const reps = parseInt(row.reps);
        const e1rm = reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
        return {
            date: row.date,
            weight_kg: weight,
            reps,
            rpe: row.rpe,
            estimated_1rm: e1rm,
        };
    });

    // Group by date and take best e1RM per session
    const byDate = {};
    for (const pt of dataPoints) {
        const dateKey = new Date(pt.date).toISOString().split('T')[0];
        if (!byDate[dateKey] || pt.estimated_1rm > byDate[dateKey].estimated_1rm) {
            byDate[dateKey] = pt;
        }
    }

    res.json({
        exercise_id: exerciseId,
        strength_curve: Object.values(byDate),
    });
}));

module.exports = router;
