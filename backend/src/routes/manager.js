const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { ValidationError, asyncHandler } = require('../utils/errors');
const cache = require('../services/cache');
const { computeCrowd } = require('../utils/crowd');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// All manager routes require manager role
router.use(authenticate, roleGuard('manager'));

/**
 * GET /api/manager/dashboard
 * Manager dashboard - gym status at a glance
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;

    // Today's check-ins
    const checkinsResult = await query(
        `SELECT COUNT(*) as count
     FROM attendances
     WHERE gym_id = $1 
     AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`,
        [gymId]
    );

    const totalCheckins = parseInt(checkinsResult.rows[0].count);

    // Active now (last 60 mins) + gym capacity in one round trip
    const activeResult = await query(
        `SELECT
       (SELECT COUNT(*) FROM attendances
        WHERE gym_id = $1 AND checked_in_at > NOW() - INTERVAL '60 minutes') AS count,
       (SELECT capacity FROM gyms WHERE id = $1) AS capacity`,
        [gymId]
    );

    const activeNow = parseInt(activeResult.rows[0].count);

    // Crowd level — occupancy vs capacity (shared green/yellow/red logic)
    const crowd = computeCrowd(activeNow, activeResult.rows[0].capacity);

    // Upcoming classes
    const classesResult = await query(
        `SELECT 
       cs.id,
       cs.name,
       cs.scheduled_at,
       u.name as trainer_name,
       COUNT(cb.id) as bookings
     FROM class_sessions cs
     LEFT JOIN users u ON cs.trainer_id = u.id
     LEFT JOIN class_bookings cb ON cs.id = cb.session_id
     WHERE cs.gym_id = $1 
       AND cs.scheduled_at > NOW()
       AND cs.scheduled_at < NOW() + INTERVAL '24 hours'
     GROUP BY cs.id, u.name
     ORDER BY cs.scheduled_at
     LIMIT 5`,
        [gymId]
    );

    // Format time until class
    const formatTimeUntil = (scheduledAt) => {
        const now = new Date();
        const scheduled = new Date(scheduledAt);
        const diffMins = Math.round((scheduled - now) / 60000);

        if (diffMins < 60) return `${diffMins} mins`;
        const hours = Math.floor(diffMins / 60);
        return `${hours}h ${diffMins % 60}m`;
    };

    const upcomingClasses = classesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        trainer: row.trainer_name,
        starts_in: formatTimeUntil(row.scheduled_at),
        bookings: parseInt(row.bookings)
    }));

    // Trainer stats
    const trainerResult = await query(
        `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE a.id IS NOT NULL) as active
     FROM users u
     LEFT JOIN attendances a ON (
       u.id = a.user_id 
       AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
     )
     WHERE u.gym_id = $1 AND u.role = 'trainer'`,
        [gymId]
    );

    const trainers = {
        total: parseInt(trainerResult.rows[0].total),
        active: parseInt(trainerResult.rows[0].active)
    };

    res.json({
        today: {
            total_checkins: totalCheckins,
            active_now: activeNow
        },
        crowd: {
            level: crowd.level,
            percentage: crowd.percentage,
            active_now: crowd.active_now,
            capacity: crowd.capacity
        },
        upcoming_classes: upcomingClasses,
        trainers
    });
}));

/**
 * POST /api/manager/users
 * Add new trainer or member
 */
router.post('/users', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;
    const { email, name, role, trainer_id } = req.body;

    // Validation
    if (!email || !name || !role) {
        throw new ValidationError('Please fill in all required fields');
    }

    if (!['member', 'trainer'].includes(role)) {
        throw new ValidationError('Invalid role. Must be member or trainer');
    }

    // Check if email already exists
    const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
        throw new ValidationError('A user with this email already exists');
    }

    // Generate temporary password (user should reset on first login)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user
    const result = await query(
        `INSERT INTO users (email, password_hash, name, role, gym_id, trainer_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, name, role`,
        [email.toLowerCase(), passwordHash, name, role, gymId, role === 'member' ? trainer_id : null]
    );

    const user = result.rows[0];
    let emailSent = false;
    let emailErrorMsg = null;

    if (resend) {
        try {
            const { data, error: sendError } = await resend.emails.send({
                from: 'Fitzo <onboarding@resend.dev>',
                to: email.toLowerCase(),
                subject: '🏋️ Welcome to Fitzo - Your Temporary Account Credentials',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #f1f5f9; border-radius: 16px;">
                        <h1 style="font-size: 24px; margin-bottom: 8px; color: #6366f1;">🏋️ Welcome to Fitzo</h1>
                        <p style="color: #94a3b8; margin-bottom: 16px;">You have been registered as a <strong>${role}</strong> on Fitzo.</p>
                        <p style="color: #94a3b8; margin-bottom: 32px;">Your temporary login password is:</p>
                        <div style="background: #1e293b; border-radius: 12px; padding: 24px; text-align: center; font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 0.1em;">
                            ${tempPassword}
                        </div>
                        <p style="color: #94a3b8; margin-top: 32px;">Please log in using your email and this temporary password, then reset your password immediately in Settings.</p>
                    </div>
                `
            });
            if (sendError) {
                console.error('Resend email error:', sendError);
                emailErrorMsg = sendError.message;
            } else {
                emailSent = true;
                console.log('Onboarding email sent successfully:', data?.id);
            }
        } catch (err) {
            console.error('Error sending onboarding email:', err.message);
            emailErrorMsg = err.message;
        }
    } else {
        emailErrorMsg = 'Email service is not configured (RESEND_API_KEY is missing)';
    }

    const isProduction = process.env.NODE_ENV === 'production';

    if (!emailSent && isProduction) {
        // Rollback created user in production if email invite cannot be sent
        await query('DELETE FROM users WHERE id = $1', [user.id]);
        throw new ValidationError(`Failed to send welcome email invite: ${emailErrorMsg}. User creation rolled back.`);
    }

    res.status(201).json({
        message: `${role === 'trainer' ? 'Trainer' : 'Member'} added successfully!${emailSent ? ' An invitation email has been sent.' : ''}`,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        },
        // Never return the credentials in production
        ...(!isProduction && !emailSent ? { temp_password: tempPassword } : {})
    });
}));

/**
 * GET /api/manager/members
 * Get all gym members
 */
router.get('/members', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;

    const result = await query(
        `SELECT 
       u.id,
       u.name,
       u.email,
       u.avatar_url,
       u.created_at as joined_at,
       t.name as trainer_name,
       CASE WHEN a.id IS NOT NULL THEN true ELSE false END as checked_in_today
     FROM users u
     LEFT JOIN users t ON u.trainer_id = t.id
     LEFT JOIN attendances a ON (
       u.id = a.user_id 
       AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
     )
     WHERE u.gym_id = $1 AND u.role = 'member'
     ORDER BY u.name`,
        [gymId]
    );

    res.json({
        members: result.rows
    });
}));

/**
 * PATCH /api/manager/gym
 * Update gym settings (currently: capacity for the crowd indicator)
 */
router.patch('/gym', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;
    const capacity = parseInt(req.body.capacity, 10);

    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 5000) {
        throw new ValidationError('Capacity must be a number between 1 and 5000');
    }

    const result = await query(
        `UPDATE gyms SET capacity = $1 WHERE id = $2 RETURNING id, name, qr_code, capacity`,
        [capacity, gymId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError("You're not assigned to a gym");
    }

    // Crowd level is cached for 5 min — bust it so the new capacity applies immediately
    await cache.del(cache.keys.crowdLevel(gymId));

    const gym = result.rows[0];
    res.json({
        success: true,
        message: `Capacity updated to ${gym.capacity} members`,
        gym: { id: gym.id, name: gym.name, access_code: gym.qr_code, capacity: gym.capacity },
    });
}));

/**
 * GET /api/manager/at-risk
 * Members who haven't checked in for N days (default 14) — churn-risk list.
 * Includes members who never checked in and joined more than N days ago.
 */
router.get('/at-risk', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 3), 90);

    const result = await query(
        `SELECT
       u.id,
       u.name,
       u.email,
       u.avatar_url,
       u.created_at AS joined_at,
       MAX(a.checked_in_at) AS last_checkin,
       COUNT(a.id)::int AS total_checkins
     FROM users u
     LEFT JOIN attendances a ON a.user_id = u.id
     WHERE u.gym_id = $1 AND u.role = 'member'
     GROUP BY u.id
     HAVING (MAX(a.checked_in_at) < NOW() - make_interval(days => $2))
         OR (MAX(a.checked_in_at) IS NULL AND u.created_at < NOW() - make_interval(days => $2))
     ORDER BY MAX(a.checked_in_at) ASC NULLS FIRST`,
        [gymId, days]
    );

    const now = Date.now();
    const members = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        avatar_url: row.avatar_url,
        joined_at: row.joined_at,
        last_checkin: row.last_checkin,
        total_checkins: row.total_checkins,
        days_inactive: row.last_checkin
            ? Math.floor((now - new Date(row.last_checkin).getTime()) / 86400000)
            : null, // null = never checked in
    }));

    res.json({
        threshold_days: days,
        count: members.length,
        members,
    });
}));

/**
 * GET /api/manager/retention
 * Weekly signup-cohort retention: of members who joined in week X,
 * what % checked in during their 1st/2nd/3rd/4th week after joining?
 * Headline number: week-4 retention across all mature members.
 */
router.get('/retention', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;

    // Per-cohort breakdown (last 8 weeks of signups)
    const cohortResult = await query(
        `WITH members AS (
       SELECT id, created_at, date_trunc('week', created_at) AS cohort_week
       FROM users
       WHERE gym_id = $1 AND role = 'member'
         AND created_at > NOW() - INTERVAL '8 weeks'
     ),
     activity AS (
       SELECT
         m.cohort_week,
         m.id,
         BOOL_OR(a.checked_in_at >= m.created_at
             AND a.checked_in_at < m.created_at + INTERVAL '7 days') AS w1,
         BOOL_OR(a.checked_in_at >= m.created_at + INTERVAL '7 days'
             AND a.checked_in_at < m.created_at + INTERVAL '14 days') AS w2,
         BOOL_OR(a.checked_in_at >= m.created_at + INTERVAL '14 days'
             AND a.checked_in_at < m.created_at + INTERVAL '21 days') AS w3,
         BOOL_OR(a.checked_in_at >= m.created_at + INTERVAL '21 days'
             AND a.checked_in_at < m.created_at + INTERVAL '28 days') AS w4
       FROM members m
       LEFT JOIN attendances a ON a.user_id = m.id
       GROUP BY m.cohort_week, m.id, m.created_at
     )
     SELECT
       cohort_week,
       COUNT(*)::int AS cohort_size,
       COUNT(*) FILTER (WHERE w1)::int AS week1,
       COUNT(*) FILTER (WHERE w2)::int AS week2,
       COUNT(*) FILTER (WHERE w3)::int AS week3,
       COUNT(*) FILTER (WHERE w4)::int AS week4
     FROM activity
     GROUP BY cohort_week
     ORDER BY cohort_week DESC`,
        [gymId]
    );

    // Headline: week-4 retention for all members old enough to measure
    const headlineResult = await query(
        `SELECT
       COUNT(*)::int AS eligible,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM attendances a
         WHERE a.user_id = u.id
           AND a.checked_in_at >= u.created_at + INTERVAL '21 days'
           AND a.checked_in_at < u.created_at + INTERVAL '28 days'
       ))::int AS retained
     FROM users u
     WHERE u.gym_id = $1 AND u.role = 'member'
       AND u.created_at < NOW() - INTERVAL '28 days'`,
        [gymId]
    );

    const { eligible, retained } = headlineResult.rows[0];
    const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);

    const cohorts = cohortResult.rows.map(row => {
        const cohortAgeDays = Math.floor((Date.now() - new Date(row.cohort_week).getTime()) / 86400000);
        return {
            cohort_week: row.cohort_week,
            cohort_size: row.cohort_size,
            week1: { count: row.week1, pct: pct(row.week1, row.cohort_size), mature: cohortAgeDays >= 7 },
            week2: { count: row.week2, pct: pct(row.week2, row.cohort_size), mature: cohortAgeDays >= 14 },
            week3: { count: row.week3, pct: pct(row.week3, row.cohort_size), mature: cohortAgeDays >= 21 },
            week4: { count: row.week4, pct: pct(row.week4, row.cohort_size), mature: cohortAgeDays >= 28 },
        };
    });

    res.json({
        summary: {
            week4_retention_pct: pct(retained, eligible),
            retained,
            eligible,
            note: eligible === 0
                ? 'No members have been signed up for 4+ weeks yet — check back soon'
                : null,
        },
        cohorts,
    });
}));

/**
 * GET /api/manager/trainers
 * Get all gym trainers
 */
router.get('/trainers', asyncHandler(async (req, res) => {
    const gymId = req.user.gym_id;

    const result = await query(
        `SELECT 
       u.id,
       u.name,
       u.email,
       u.avatar_url,
       u.created_at as joined_at,
       COUNT(m.id) as member_count,
       CASE WHEN a.id IS NOT NULL THEN true ELSE false END as checked_in_today
     FROM users u
     LEFT JOIN users m ON m.trainer_id = u.id AND m.role = 'member'
     LEFT JOIN attendances a ON (
       u.id = a.user_id 
       AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
     )
     WHERE u.gym_id = $1 AND u.role = 'trainer'
     GROUP BY u.id, a.id
     ORDER BY u.name`,
        [gymId]
    );

    res.json({
        trainers: result.rows.map(t => ({
            ...t,
            member_count: parseInt(t.member_count)
        }))
    });
}));

module.exports = router;
