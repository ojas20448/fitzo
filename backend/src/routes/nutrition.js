/**
 * Nutrition Profile Routes
 * User nutrition goals, targets, and body metrics
 */

const express = require('express');
const router = express.Router();
const { summariseWeek } = require('../utils/weekSummary');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../utils/errors');
const { invalidateContextPack } = require('../services/contextPack');
const foodPrefs = require('../services/foodPrefs');
const cache = require('../services/cache');
const { validateComboItems } = require('../utils/mealCombo');
const mealPresets = require('../data/meal-presets.json');
const { IST_TODAY_SQL } = require('../utils/dayBoundary');

const { resolveTargets, legacyModes } = require('../utils/nutritionTargets');

/**
 * GET /api/nutrition/profile
 * Get current user's nutrition profile
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT * FROM nutrition_profiles WHERE user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return res.json({ profile: null });
    }

    const profile = result.rows[0];

    res.json({
        profile: {
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            age: profile.age,
            gender: profile.gender,
            activity_level: profile.activity_level,
            goal_type: profile.goal_type,
            target_weight_kg: profile.target_weight_kg,
            target_calories: profile.target_calories,
            target_protein: profile.target_protein,
            target_carbs: profile.target_carbs,
            target_fat: profile.target_fat,
            is_vegetarian: profile.is_vegetarian,
            protein_priority: profile.protein_priority,
            calorie_target_mode: profile.calorie_target_mode ?? legacyModes(profile).calorie_target_mode,
            macro_target_mode: profile.macro_target_mode ?? legacyModes(profile).macro_target_mode,
        }
    });
}));

/**
 * POST /api/nutrition/profile
 * Create or update nutrition profile with auto-calculated targets
 */
router.post('/profile', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        weight_kg,
        height_cm,
        age,
        gender,
        activity_level = 'sedentary',
        goal_type = 'maintenance',
        target_weight_kg,
        is_vegetarian = false,
        body_fat_pct,
        // Optional: manually set targets (otherwise auto-calculated)
        target_calories,
        target_protein,
        target_carbs,
        target_fat,
    } = req.body;

    let targets;
    try {
        targets = resolveTargets({ ...req.body, activity_level, goal_type });
    } catch (error) {
        throw new ValidationError(error.message);
    }
    const { target_calories: calories, target_protein: protein, target_carbs: carbs, target_fat: fat } = targets;

    // Upsert profile
    const result = await query(
        `INSERT INTO nutrition_profiles (
            user_id, weight_kg, height_cm, age, gender, activity_level, goal_type,
            target_weight_kg, target_calories, target_protein, target_carbs, target_fat,
            is_vegetarian, calorie_target_mode, macro_target_mode, target_formula_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (user_id) DO UPDATE SET
            weight_kg = EXCLUDED.weight_kg,
            height_cm = EXCLUDED.height_cm,
            age = EXCLUDED.age,
            gender = EXCLUDED.gender,
            activity_level = EXCLUDED.activity_level,
            goal_type = EXCLUDED.goal_type,
            target_weight_kg = EXCLUDED.target_weight_kg,
            target_calories = EXCLUDED.target_calories,
            target_protein = EXCLUDED.target_protein,
            target_carbs = EXCLUDED.target_carbs,
            target_fat = EXCLUDED.target_fat,
            is_vegetarian = EXCLUDED.is_vegetarian,
            calorie_target_mode = EXCLUDED.calorie_target_mode,
            macro_target_mode = EXCLUDED.macro_target_mode,
            target_formula_version = EXCLUDED.target_formula_version,
            updated_at = NOW()
        RETURNING *`,
        [userId, weight_kg, height_cm, age, gender, activity_level, goal_type,
            target_weight_kg, calories, protein, carbs, fat, is_vegetarian, targets.calorie_target_mode, targets.macro_target_mode, targets.target_formula_version]
    );

    const profile = result.rows[0];

    // Invalidate context pack cache for fresh AI responses
    invalidateContextPack(userId).catch(() => {});

    res.json({
        message: 'Profile updated',
        profile: {
            target_calories: profile.target_calories,
            target_protein: profile.target_protein,
            target_carbs: profile.target_carbs,
            target_fat: profile.target_fat,
            goal_type: profile.goal_type,
            calorie_target_mode: profile.calorie_target_mode,
            macro_target_mode: profile.macro_target_mode,
        }
    });
}));

/**
 * GET /api/nutrition/today
 * Get today's nutrition summary with targets
 */
router.get('/today', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get profile
    const profileResult = await query(
        `SELECT target_calories, target_protein, target_carbs, target_fat, goal_type
         FROM nutrition_profiles WHERE user_id = $1`,
        [userId]
    );

    const profile = profileResult.rows[0] || {
        target_calories: 2000,
        target_protein: 150,
        target_carbs: 200,
        target_fat: 67,
    };

    // Get today's logged calories
    const logsResult = await query(
        `SELECT 
            COALESCE(SUM(calories), 0) as total_calories,
            COALESCE(SUM(protein), 0) as total_protein,
            COALESCE(SUM(carbs), 0) as total_carbs,
            COALESCE(SUM(fat), 0) as total_fat
         FROM calorie_logs
         WHERE user_id = $1 AND logged_date = ${IST_TODAY_SQL}`,
        [userId]
    );

    const logged = logsResult.rows[0];

    // The activity estimate already includes regular training. An intent is not
    // measured energy expenditure: do not add protein/calories or cut rest days.
    const { target_calories: targetCalories, target_protein: targetProtein,
        target_carbs: targetCarbs, target_fat: targetFat } = profile;

    res.json({
        targets: {
            calories: targetCalories,
            protein: targetProtein,
            carbs: targetCarbs,
            fat: targetFat,
        },
        logged: {
            calories: parseInt(logged.total_calories),
            protein: parseInt(logged.total_protein),
            carbs: parseInt(logged.total_carbs),
            fat: parseInt(logged.total_fat),
        },
        remaining: {
            calories: profile.target_calories - parseInt(logged.total_calories),
            protein: profile.target_protein - parseInt(logged.total_protein),
            carbs: profile.target_carbs - parseInt(logged.total_carbs),
            fat: profile.target_fat - parseInt(logged.total_fat),
        },
        goal_type: profile.goal_type,
    });
}));

/**
 * GET /api/nutrition/weekly
 * Get last 7 days nutrition history
 */
router.get('/weekly', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Independent queries — run them together rather than in sequence.
    const [result, profileResult] = await Promise.all([
        query(
            `SELECT
                logged_date as date,
                SUM(calories) as calories,
                SUM(protein) as protein,
                SUM(carbs) as carbs,
                SUM(fat) as fat
             FROM calorie_logs
             WHERE user_id = $1
               AND logged_date > ${IST_TODAY_SQL} - INTERVAL '7 days'
             GROUP BY logged_date
             ORDER BY date ASC`,
            [userId]
        ),
        query(
            `SELECT target_calories, target_protein
             FROM nutrition_profiles WHERE user_id = $1`,
            [userId]
        ),
    ]);

    // `history` keeps its existing shape and meaning — StatsScreen consumes it.
    // `summary` is additive. summariseWeek applies its own target defaults when
    // the member has no nutrition_profiles row.
    res.json({
        history: result.rows,
        summary: summariseWeek(result.rows, profileResult.rows[0]),
    });
}));

/**
 * POST /api/nutrition/log
 * Log a food item
 */
router.post('/log', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        food_name,
        calories,
        protein,
        carbs,
        fat,
        serving_size,
        cooking_medium,
        meal_type = 'snack', // breakfast, lunch, dinner, snack
        visibility = 'friends'
    } = req.body;

    if (!food_name || calories === undefined) {
        throw new ValidationError('Food name and calories are required');
    }

    const validVisibility = ['public', 'friends', 'private'];
    if (!validVisibility.includes(visibility)) {
        throw new ValidationError('Invalid visibility option');
    }

    const result = await query(
        `INSERT INTO calorie_logs (
            user_id, food_name, calories, protein, carbs, fat, serving_size, meal_type, visibility, logged_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${IST_TODAY_SQL})
        RETURNING *`,
        [userId, food_name, calories, protein || 0, carbs || 0, fat || 0, serving_size, meal_type, visibility]
    );

    // Invalidate context pack cache for fresh AI responses
    invalidateContextPack(userId).catch(() => {});

    // Fire-and-forget: a preference write must never fail a food log.
    if (cooking_medium) {
        foodPrefs.recordMediumChoice(userId, food_name, cooking_medium)
            .catch(() => {});
    }

    res.json({
        message: 'Food logged successfully',
        log: result.rows[0]
    });
}));

/**
 * POST /api/nutrition/log-bulk
 * Log a whole meal in one action (the thali case) — 2 roti + dal + sabzi +
 * rice + curd, in a single request instead of five search-and-tap flows.
 * All-or-nothing: a partially logged meal is worse than a failed one, so this
 * is one multi-row INSERT rather than a loop of single inserts.
 */
router.post('/log-bulk', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { items, meal_type = 'snack', visibility = 'friends' } = req.body;

    const { valid, error, items: cleaned } = validateComboItems(items);
    if (!valid) throw new ValidationError(error);

    const validVisibility = ['public', 'friends', 'private'];
    if (!validVisibility.includes(visibility)) {
        throw new ValidationError('Invalid visibility option');
    }

    // Single multi-row INSERT — one round trip, atomic by definition.
    // Column list matches the POST /log INSERT above exactly: user_id,
    // food_name, calories, protein, carbs, fat, serving_size, meal_type,
    // visibility. (mealCombo items use `meal_name`, mapped to the food_name
    // column here — the same field this app already renames once elsewhere.)
    const values = [];
    const placeholders = cleaned.map((it, i) => {
        const b = i * 9;
        values.push(
            userId, it.meal_name, it.calories, it.protein, it.carbs, it.fat,
            null, meal_type, visibility
        );
        // logged_date is appended as a literal SQL expression, not a bound
        // value — it must not consume a $n or shift any placeholder index.
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, ${IST_TODAY_SQL})`;
    });

    await query(
        `INSERT INTO calorie_logs (
            user_id, food_name, calories, protein, carbs, fat, serving_size, meal_type, visibility, logged_date
        ) VALUES ${placeholders.join(', ')}`,
        values
    );

    const totals = cleaned.reduce(
        (acc, it) => ({
            calories: acc.calories + it.calories,
            protein: acc.protein + it.protein,
            carbs: acc.carbs + it.carbs,
            fat: acc.fat + it.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // Invalidate cached nutrition totals and context pack for fresh AI responses
    await cache.del(cache.keys.nutritionToday(userId));
    invalidateContextPack(userId).catch(() => {});

    // Fire-and-forget: a preference write must never fail a food log.
    cleaned.forEach((it) => {
        if (it.cooking_medium) {
            foodPrefs.recordMediumChoice(userId, it.meal_name, it.cooking_medium).catch(() => {});
        }
    });

    res.status(201).json({ success: true, logged: cleaned.length, totals });
}));

/**
 * POST /api/nutrition/recalculate-all
 * Admin: Force recalculate TDEE & macros for all users using Mifflin-St Jeor
 */
router.post('/recalculate-all', authenticate, asyncHandler(async (req, res) => {
    // Only allow managers (admin) to trigger this
    if (req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Admin only' });
    }

    const profiles = await query(`SELECT * FROM nutrition_profiles`);
    let updated = 0;
    let skipped = 0;

    for (const p of profiles.rows) {
        if (!p.weight_kg || !p.height_cm || !p.age || !p.gender) {
            skipped++;
            continue;
        }

        let targets;
        try { targets = resolveTargets(p); } catch { skipped++; continue; }
        await query(
            `UPDATE nutrition_profiles
             SET target_calories = $1, target_protein = $2, target_carbs = $3, target_fat = $4,
                 calorie_target_mode = $5, macro_target_mode = $6, target_formula_version = $7, updated_at = NOW()
             WHERE id = $8`,
            [targets.target_calories, targets.target_protein, targets.target_carbs, targets.target_fat,
                targets.calorie_target_mode, targets.macro_target_mode, targets.target_formula_version, p.id]
        );
        invalidateContextPack(p.user_id).catch(() => {});
        updated++;
    }

    res.json({ message: `Recalculated ${updated} profiles, skipped ${skipped}` });
}));

/**
 * GET /api/nutrition/presets
 * Common Indian meal combos for one-tap logging.
 */
router.get('/presets', authenticate, asyncHandler(async (req, res) => {
    res.json({ presets: mealPresets });
}));

module.exports = router;
