const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');
const communityFoods = require('../services/communityFoods');
const cache = require('../services/cache');
const xpService = require('../services/xpService');
const { IST_TODAY_SQL, isValidDateString } = require('../utils/dayBoundary');
const { validateEntryPatch } = require('../utils/entryEdit');

// All routes require authentication
router.use(authenticate);

// ============================================
// LOG CALORIES
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { calories, protein = 0, carbs = 0, fat = 0, meal_name, visibility = 'friends', food_id = null } = req.body;

    // Provenance for community-contributed foods. Optional and best-effort:
    // the overwhelming majority of logs are free-text or curated-catalog and
    // carry no food_id at all, so this must never be able to fail a log.
    const communityFoodId = communityFoods.isCommunityId(food_id)
        ? communityFoods.stripPrefix(food_id)
        : null;

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
        `INSERT INTO calorie_logs (user_id, calories, protein, carbs, fat, food_name, visibility, community_food_id, logged_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${IST_TODAY_SQL})
         RETURNING *`,
        [userId, calories, protein, carbs, fat, meal_name || null, visibility, communityFoodId]
    );

    // Usage counter behind the CLI's --promote ranking. Deliberately not
    // awaited into the response path and swallowing its own errors: a counter
    // is not worth failing a member's food log over.
    if (communityFoodId) communityFoods.recordLog(food_id);

    // Award XP for logging
    await xpService.awardXP(userId, 2, 'nutrition', result.rows[0].id);

    // Auto-mark attendance for streak tracking.
    //
    // NOTE: CURRENT_DATE (UTC) on purpose, NOT the IST boundary used above.
    // `attendances` is read by get_user_streak() (db/schema.sql), which
    // initialises check_date := CURRENT_DATE and walks backwards in UTC, and by
    // four other writers that all use CURRENT_DATE. Stamping IST here alone
    // would put this row a day ahead of everything that reads it, so between
    // 00:00 and 05:30 IST the day would read as missed and the streak would
    // drop until UTC caught up. Moving attendances to IST is a separate change
    // that has to move the streak function and all five writers together.
    await query(
        `INSERT INTO attendances (user_id, gym_id, check_date)
         VALUES ($1, (SELECT gym_id FROM users WHERE id = $1), CURRENT_DATE)
         ON CONFLICT (user_id, check_date) DO NOTHING`,
        [userId]
    );

    // Invalidate cached nutrition totals
    await cache.del(cache.keys.nutritionToday(userId));

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
         WHERE user_id = $1 AND logged_date = ${IST_TODAY_SQL}
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
         WHERE user_id = $1 AND logged_date = ${IST_TODAY_SQL}`,
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

/**
 * GET /api/calories/day/:date
 * Entries for one day, 'YYYY-MM-DD'. Same shape as /today.
 */
router.get('/day/:date', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { date } = req.params;

    if (!isValidDateString(date)) {
        throw new ValidationError('Date must be YYYY-MM-DD');
    }

    const entries = await query(
        `SELECT * FROM calorie_logs
          WHERE user_id = $1 AND logged_date = $2::date
          ORDER BY created_at DESC`,
        [userId, date]
    );

    const totals = await query(
        `SELECT
            COALESCE(SUM(calories), 0) as total_calories,
            COALESCE(SUM(protein), 0) as total_protein,
            COALESCE(SUM(carbs), 0) as total_carbs,
            COALESCE(SUM(fat), 0) as total_fat,
            COUNT(*) as entry_count
         FROM calorie_logs
         WHERE user_id = $1 AND logged_date = $2::date`,
        [userId, date]
    );

    res.json({
        date,
        entries: entries.rows,
        totals: {
            calories: parseInt(totals.rows[0].total_calories),
            protein: parseInt(totals.rows[0].total_protein),
            carbs: parseInt(totals.rows[0].total_carbs),
            fat: parseInt(totals.rows[0].total_fat),
            entry_count: parseInt(totals.rows[0].entry_count),
        },
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
         WHERE c.logged_date >= ${IST_TODAY_SQL} - INTERVAL '7 days'
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
// EDIT A CALORIE ENTRY
// ============================================

/**
 * PATCH /api/calories/:id
 * Correct a logged entry. Only the fields sent are changed — omitted columns
 * keep their current value, so fixing calories cannot blank the macros.
 */
router.patch('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const entryId = req.params.id;

    const { valid, error, fields } = validateEntryPatch(req.body);
    if (!valid) throw new ValidationError(error);

    // Build a partial UPDATE from exactly the keys that were sent. COALESCE is
    // not needed because absent keys never appear in the SET list at all.
    const keys = Object.keys(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => fields[k]);

    const result = await query(
        `UPDATE calorie_logs
            SET ${setClause}
          WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}
      RETURNING *`,
        [...values, entryId, userId]
    );

    if (result.rows.length === 0) {
        // 404 rather than 403: 403 would confirm the row exists but belongs to
        // someone else. Matches the DELETE handler below.
        throw new NotFoundError('Entry not found');
    }

    await cache.del(cache.keys.nutritionToday(userId));

    res.json({ success: true, entry: result.rows[0] });
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
