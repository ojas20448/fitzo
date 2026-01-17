const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');

// All routes require authentication
router.use(authenticate);

// ============================================
// LOG CALORIES
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { calories, protein = 0, carbs = 0, fat = 0, meal_name, visibility = 'friends' } = req.body;

    // Validation
    if (!calories || calories < 0) {
        throw new ValidationError('Please enter valid calories');
    }

    if (calories > 10000) {
        throw new ValidationError('Calorie value seems too high');
    }

    const validVisibility = ['public', 'friends', 'private'];
    if (!validVisibility.includes(visibility)) {
        throw new ValidationError('Invalid visibility option');
    }

    const result = await query(
        `INSERT INTO calorie_logs (user_id, calories, protein, carbs, fat, food_name, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, calories, protein, carbs, fat, meal_name || null, visibility]
    );

    // Award XP for logging
    await query(
        `UPDATE users SET xp_points = xp_points + 2 WHERE id = $1`,
        [userId]
    );

    res.json({
        success: true,
        entry: result.rows[0],
        xp_earned: 2
    });
}));

// ============================================
// GET TODAY'S CALORIES
// ============================================
router.get('/today', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const entries = await query(
        `SELECT * FROM calorie_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE
         ORDER BY created_at DESC`,
        [userId]
    );

    // Get daily totals
    const totals = await query(
        `SELECT 
            COALESCE(SUM(calories), 0) as total_calories,
            COALESCE(SUM(protein), 0) as total_protein,
            COALESCE(SUM(carbs), 0) as total_carbs,
            COALESCE(SUM(fat), 0) as total_fat,
            COUNT(*) as entry_count
         FROM calorie_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE`,
        [userId]
    );

    res.json({
        entries: entries.rows,
        totals: {
            calories: parseInt(totals.rows[0].total_calories),
            protein: parseInt(totals.rows[0].total_protein),
            carbs: parseInt(totals.rows[0].total_carbs),
            fat: parseInt(totals.rows[0].total_fat),
            entry_count: parseInt(totals.rows[0].entry_count)
        }
    });
}));

// ============================================
// GET CALORIE HISTORY
// ============================================
router.get('/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;

    const result = await query(
        `SELECT logged_date,
                SUM(calories) as total_calories,
                SUM(protein) as total_protein,
                SUM(carbs) as total_carbs,
                SUM(fat) as total_fat,
                COUNT(*) as entry_count
         FROM calorie_logs 
         WHERE user_id = $1
         GROUP BY logged_date
         ORDER BY logged_date DESC
         LIMIT $2`,
        [userId, limit]
    );

    res.json({ history: result.rows });
}));

// ============================================
// GET FRIENDS' CALORIE FEED
// ============================================
router.get('/feed', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get daily totals from friends (respecting privacy)
    const result = await query(
        `SELECT u.id as user_id, u.name, u.avatar_url,
                c.logged_date,
                SUM(c.calories) as total_calories
         FROM calorie_logs c
         JOIN users u ON c.user_id = u.id
         WHERE c.logged_date >= CURRENT_DATE - INTERVAL '7 days'
         AND (
             c.visibility = 'public'
             OR 
             (c.visibility = 'friends' AND EXISTS (
                 SELECT 1 FROM friendships f 
                 WHERE f.status = 'accepted'
                 AND ((f.user_id = $1 AND f.friend_id = c.user_id)
                      OR (f.friend_id = $1 AND f.user_id = c.user_id))
             ))
         )
         AND c.user_id != $1
         GROUP BY u.id, u.name, u.avatar_url, c.logged_date
         ORDER BY c.logged_date DESC, total_calories DESC
         LIMIT 20`,
        [userId]
    );

    res.json({ feed: result.rows });
}));

// ============================================
// DELETE A CALORIE ENTRY
// ============================================
router.delete('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const entryId = req.params.id;

    const result = await query(
        `DELETE FROM calorie_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
        [entryId, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Entry not found');
    }

    res.json({ success: true });
}));

// ============================================
// GET FREQUENT FOODS
// ============================================
router.get('/frequent', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const result = await query(
        `SELECT food_name as name, 
                ROUND(AVG(calories)) as calories, 
                ROUND(AVG(protein)) as protein, 
                ROUND(AVG(carbs)) as carbs, 
                ROUND(AVG(fat)) as fat,
                COUNT(*) as usage_count
         FROM calorie_logs 
         WHERE user_id = $1 AND food_name IS NOT NULL
         GROUP BY food_name
         ORDER BY usage_count DESC
         LIMIT $2`,
        [userId, limit]
    );

    res.json({ frequent: result.rows });
}));

module.exports = router;
