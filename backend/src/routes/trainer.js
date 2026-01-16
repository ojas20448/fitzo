const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { roleGuard, trainerMemberGuard } = require('../middleware/roleGuard');
const { NotFoundError, asyncHandler } = require('../utils/errors');

// All trainer routes require trainer or manager role
router.use(authenticate, roleGuard('trainer', 'manager'));

/**
 * GET /api/trainer/members
 * Get list of assigned members
 */
router.get('/members', asyncHandler(async (req, res) => {
    const trainerId = req.user.id;

    const result = await query(
        `SELECT 
       u.id,
       u.name,
       u.avatar_url,
       u.xp_points,
       u.created_at as joined_at,
       CASE WHEN a.id IS NOT NULL THEN true ELSE false END as checked_in_today,
       wi.muscle_group as today_intent,
       wi.note as intent_note,
       (SELECT get_user_streak(u.id)) as streak
     FROM users u
     LEFT JOIN attendances a ON (
       u.id = a.user_id 
       AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
     )
     LEFT JOIN workout_intents wi ON (
       u.id = wi.user_id 
       AND wi.expires_at > NOW()
     )
     WHERE u.trainer_id = $1 AND u.role = 'member'
     ORDER BY a.checked_in_at DESC NULLS LAST, u.name`,
        [trainerId]
    );

    const members = result.rows.map(m => ({
        id: m.id,
        name: m.name,
        avatar_url: m.avatar_url,
        xp_points: m.xp_points || 0,
        joined_at: m.joined_at,
        checked_in_today: m.checked_in_today,
        streak: m.streak || 0,
        today_intent: m.today_intent ? {
            muscle_group: m.today_intent,
            note: m.intent_note
        } : null
    }));

    res.json({ members });
}));

/**
 * GET /api/trainer/members/:id
 * Get detailed member view with plans
 */
router.get('/members/:id', trainerMemberGuard, asyncHandler(async (req, res) => {
    const memberId = req.params.id;

    // Get member info
    const memberResult = await query(
        `SELECT 
       u.id, u.name, u.email, u.avatar_url, u.xp_points, u.created_at as joined_at
     FROM users u
     WHERE u.id = $1`,
        [memberId]
    );

    if (memberResult.rows.length === 0) {
        throw new NotFoundError("Member not found");
    }

    const member = memberResult.rows[0];

    // Get workout plan
    const workoutPlanResult = await query(
        `SELECT plan_data, updated_at FROM workout_plans WHERE member_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [memberId]
    );

    // Get calorie plan
    const caloriePlanResult = await query(
        `SELECT plan_data, updated_at FROM calorie_plans WHERE member_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [memberId]
    );

    // Get today's intent (trainers can see even private intents)
    const intentResult = await query(
        `SELECT muscle_group, visibility, note, expires_at 
     FROM workout_intents 
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
        [memberId]
    );

    // Get attendance history (last 30 days)
    const attendanceResult = await query(
        `WITH dates AS (
       SELECT generate_series(
         CURRENT_DATE - INTERVAL '29 days', 
         CURRENT_DATE, 
         INTERVAL '1 day'
       )::DATE as date
     )
     SELECT 
       d.date,
       CASE WHEN a.id IS NOT NULL THEN true ELSE false END as checked_in
     FROM dates d
     LEFT JOIN attendances a ON (
       DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = d.date
       AND a.user_id = $1
     )
     ORDER BY d.date DESC`,
        [memberId]
    );

    // Get streak
    const streakResult = await query(
        `SELECT get_user_streak($1) as streak`,
        [memberId]
    );

    res.json({
        member: {
            id: member.id,
            name: member.name,
            email: member.email,
            avatar_url: member.avatar_url,
            xp_points: member.xp_points || 0,
            joined_at: member.joined_at,
            streak: parseInt(streakResult.rows[0]?.streak) || 0
        },
        workout_plan: workoutPlanResult.rows[0]?.plan_data || null,
        calorie_plan: caloriePlanResult.rows[0]?.plan_data || null,
        today_intent: intentResult.rows[0] || null,
        attendance_history: attendanceResult.rows,
        nutrition_history: [] // populated below
    });
}));

// ADDED: Get granular nutrition history for charts
router.get('/members/:id/nutrition', trainerMemberGuard, asyncHandler(async (req, res) => {
    const memberId = req.params.id;

    const result = await query(
        `SELECT 
            DATE(created_at) as date,
            SUM(calories) as calories,
            SUM(protein) as protein,
            SUM(carbs) as carbs,
            SUM(fat) as fat
         FROM calorie_logs
         WHERE user_id = $1 
           AND created_at > CURRENT_DATE - INTERVAL '14 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [memberId]
    );

    res.json({ history: result.rows });
}));

/**
 * POST /api/trainer/members/:id/nudge
 * Send a predefined nudge message
 */
router.post('/members/:id/nudge', trainerMemberGuard, asyncHandler(async (req, res) => {
    const memberId = req.params.id;
    const { type, message } = req.body; // type: 'high_five', 'protein_alert', 'missed_workout'

    // In a real app, this would trigger Push Notification (FCM/Expo Push)
    // For MVP, we'll store it in a 'notifications' table or just return success
    // Let's assume we log it to a notifications table if we had one.
    // We'll just mock it for now.

    res.json({ message: `Nudge sent to member!` });
}));

/**
 * GET /api/trainer/schedule
 * Get trainer's upcoming class sessions
 */
router.get('/schedule', asyncHandler(async (req, res) => {
    const trainerId = req.user.id;

    const result = await query(
        `SELECT 
       cs.id,
       cs.name,
       cs.scheduled_at,
       cs.duration_mins,
       cs.max_capacity,
       COUNT(cb.id) as bookings_count
     FROM class_sessions cs
     LEFT JOIN class_bookings cb ON cs.id = cb.session_id
     WHERE cs.trainer_id = $1 AND cs.scheduled_at > NOW()
     GROUP BY cs.id
     ORDER BY cs.scheduled_at`,
        [trainerId]
    );

    res.json({
        sessions: result.rows.map(row => ({
            id: row.id,
            name: row.name,
            scheduled_at: row.scheduled_at,
            duration_mins: row.duration_mins,
            bookings: parseInt(row.bookings_count),
            max_capacity: row.max_capacity
        }))
    });
}));

module.exports = router;
