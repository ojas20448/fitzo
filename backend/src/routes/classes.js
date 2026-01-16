const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ConflictError, NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * GET /api/classes
 * Get upcoming class sessions
 * Query params: ?date=2024-01-15 (optional, defaults to today)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;
    const dateParam = req.query.date;

    // Build date filter
    let dateFilter;
    if (dateParam) {
        dateFilter = `DATE(cs.scheduled_at AT TIME ZONE 'Asia/Kolkata') = $2`;
    } else {
        dateFilter = `cs.scheduled_at > NOW()`;
    }

    const queryParams = dateParam ? [gymId, dateParam] : [gymId];

    const result = await query(
        `SELECT 
       cs.id,
       cs.name,
       cs.scheduled_at,
       cs.duration_mins,
       cs.max_capacity,
       u.name as trainer_name,
       u.avatar_url as trainer_avatar,
       COUNT(cb.id) as bookings_count,
       CASE WHEN ub.id IS NOT NULL THEN true ELSE false END as is_booked
     FROM class_sessions cs
     LEFT JOIN users u ON cs.trainer_id = u.id
     LEFT JOIN class_bookings cb ON cs.id = cb.session_id
     LEFT JOIN class_bookings ub ON cs.id = ub.session_id AND ub.user_id = $${queryParams.length + 1}
     WHERE cs.gym_id = $1 AND ${dateFilter}
     GROUP BY cs.id, u.name, u.avatar_url, ub.id
     ORDER BY cs.scheduled_at`,
        [...queryParams, userId]
    );

    // Group by time of day
    const sessions = result.rows.map(row => {
        const scheduledAt = new Date(row.scheduled_at);
        const hour = scheduledAt.getHours();

        return {
            id: row.id,
            name: row.name,
            trainer: {
                name: row.trainer_name,
                avatar_url: row.trainer_avatar
            },
            scheduled_at: row.scheduled_at,
            duration_mins: row.duration_mins,
            slots_available: row.max_capacity - parseInt(row.bookings_count),
            max_capacity: row.max_capacity,
            is_booked: row.is_booked,
            time_of_day: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
        };
    });

    res.json({ sessions });
}));

/**
 * POST /api/classes/:id/book
 * Book a class session
 */
router.post('/:id/book', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessionId = req.params.id;

    // Check if session exists and has capacity
    const sessionResult = await query(
        `SELECT 
       cs.id, cs.name, cs.max_capacity,
       COUNT(cb.id) as bookings_count
     FROM class_sessions cs
     LEFT JOIN class_bookings cb ON cs.id = cb.session_id
     WHERE cs.id = $1
     GROUP BY cs.id`,
        [sessionId]
    );

    if (sessionResult.rows.length === 0) {
        throw new NotFoundError("Class not found");
    }

    const session = sessionResult.rows[0];
    const currentBookings = parseInt(session.bookings_count);

    if (currentBookings >= session.max_capacity) {
        throw new ConflictError("This class is full. Try another time?");
    }

    // Check if already booked
    const existingBooking = await query(
        `SELECT id FROM class_bookings WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
    );

    if (existingBooking.rows.length > 0) {
        throw new ConflictError("You're already booked for this class");
    }

    // Create booking
    await query(
        `INSERT INTO class_bookings (session_id, user_id) VALUES ($1, $2)`,
        [sessionId, userId]
    );

    res.status(201).json({
        success: true,
        message: `You're booked for ${session.name}! 🎉`,
        class_name: session.name
    });
}));

/**
 * DELETE /api/classes/:id/book
 * Cancel a class booking
 */
router.delete('/:id/book', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessionId = req.params.id;

    const result = await query(
        `DELETE FROM class_bookings 
     WHERE session_id = $1 AND user_id = $2
     RETURNING id`,
        [sessionId, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError("Booking not found");
    }

    res.json({
        success: true,
        message: "Booking cancelled"
    });
}));

/**
 * GET /api/classes/my-bookings
 * Get user's upcoming class bookings
 */
router.get('/my-bookings', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT 
       cs.id,
       cs.name,
       cs.scheduled_at,
       cs.duration_mins,
       u.name as trainer_name,
       cb.booked_at
     FROM class_bookings cb
     JOIN class_sessions cs ON cb.session_id = cs.id
     LEFT JOIN users u ON cs.trainer_id = u.id
     WHERE cb.user_id = $1 AND cs.scheduled_at > NOW()
     ORDER BY cs.scheduled_at`,
        [userId]
    );

    res.json({
        bookings: result.rows.map(row => ({
            id: row.id,
            name: row.name,
            scheduled_at: row.scheduled_at,
            duration_mins: row.duration_mins,
            trainer_name: row.trainer_name,
            booked_at: row.booked_at
        }))
    });
}));

module.exports = router;
