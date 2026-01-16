const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { ValidationError, asyncHandler } = require('../utils/errors');

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

    // Active now (last 60 mins)
    const activeResult = await query(
        `SELECT COUNT(*) as count
     FROM attendances
     WHERE gym_id = $1 
     AND checked_in_at > NOW() - INTERVAL '60 minutes'`,
        [gymId]
    );

    const activeNow = parseInt(activeResult.rows[0].count);

    // Crowd level
    let crowdLevel = 'low';
    let crowdPercentage = 20;
    if (activeNow >= 40) {
        crowdLevel = 'high';
        crowdPercentage = 90;
    } else if (activeNow >= 20) {
        crowdLevel = 'medium';
        crowdPercentage = 60;
    }

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
            level: crowdLevel,
            percentage: crowdPercentage
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

    res.status(201).json({
        message: `${role === 'trainer' ? 'Trainer' : 'Member'} added successfully!`,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        },
        // In production, send this via email instead
        temp_password: tempPassword
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
