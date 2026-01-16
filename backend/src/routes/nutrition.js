/**
 * Nutrition Profile Routes
 * User nutrition goals, targets, and body metrics
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../utils/errors');

/**
 * Calculate macro targets based on calories and goal
 */
function calculateMacros(calories, goal) {
    // Protein-first approach for gym members
    let proteinPct, carbsPct, fatPct;

    switch (goal) {
        case 'fat_loss':
            proteinPct = 0.35; // Higher protein for muscle preservation
            fatPct = 0.30;
            carbsPct = 0.35;
            break;
        case 'muscle_gain':
            proteinPct = 0.30;
            fatPct = 0.25;
            carbsPct = 0.45; // Higher carbs for energy
            break;
        default: // maintenance
            proteinPct = 0.30;
            fatPct = 0.30;
            carbsPct = 0.40;
    }

    return {
        protein: Math.round((calories * proteinPct) / 4), // 4 cal per gram
        carbs: Math.round((calories * carbsPct) / 4),
        fat: Math.round((calories * fatPct) / 9), // 9 cal per gram
    };
}

/**
 * Calculate daily calories using Mifflin-St Jeor equation
 */
function calculateTDEE(weight, height, age, gender, activityLevel, goal) {
    // Mifflin-St Jeor BMR
    let bmr;
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Activity multiplier
    const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9,
    };

    const tdee = bmr * (multipliers[activityLevel] || 1.55);

    // Goal adjustment
    const adjustments = {
        fat_loss: -400,
        muscle_gain: 300,
        maintenance: 0,
    };

    return Math.round(tdee + (adjustments[goal] || 0));
}

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
        activity_level = 'moderate',
        goal_type = 'maintenance',
        target_weight_kg,
        is_vegetarian = false,
        // Optional: manually set targets (otherwise auto-calculated)
        target_calories,
        target_protein,
        target_carbs,
        target_fat,
    } = req.body;

    // Validation
    if (!weight_kg || !height_cm || !age || !gender) {
        throw new ValidationError('Weight, height, age, and gender are required');
    }

    // Calculate targets if not provided
    let calories = target_calories;
    let protein = target_protein;
    let carbs = target_carbs;
    let fat = target_fat;

    if (!calories) {
        calories = calculateTDEE(weight_kg, height_cm, age, gender, activity_level, goal_type);
        const macros = calculateMacros(calories, goal_type);
        protein = protein || macros.protein;
        carbs = carbs || macros.carbs;
        fat = fat || macros.fat;
    }

    // Upsert profile
    const result = await query(
        `INSERT INTO nutrition_profiles (
            user_id, weight_kg, height_cm, age, gender, activity_level, goal_type,
            target_weight_kg, target_calories, target_protein, target_carbs, target_fat,
            is_vegetarian
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            updated_at = NOW()
        RETURNING *`,
        [userId, weight_kg, height_cm, age, gender, activity_level, goal_type,
            target_weight_kg, calories, protein, carbs, fat, is_vegetarian]
    );

    const profile = result.rows[0];

    res.json({
        message: 'Profile updated',
        profile: {
            target_calories: profile.target_calories,
            target_protein: profile.target_protein,
            target_carbs: profile.target_carbs,
            target_fat: profile.target_fat,
            goal_type: profile.goal_type,
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
         WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [userId]
    );

    const logged = logsResult.rows[0];

    // Get today's intent for dynamic adjustments
    const intentResult = await query(
        `SELECT split_type, emphasis FROM workout_intents 
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );

    const intent = intentResult.rows[0];

    // Base targets from profile
    let targetCalories = profile.target_calories;
    let targetProtein = profile.target_protein;
    let targetCarbs = profile.target_carbs;
    let targetFat = profile.target_fat;

    // Apply adjustments based on intent
    if (intent) {
        const type = intent.split_type;
        const emphasis = intent.emphasis || [];

        // REST DAY
        if (type === 'rest' || emphasis.includes('rest')) {
            targetCalories -= 200;
            // Base protein/fat/carbs usually stay similar or scale down. 
            // Plan says "-200 calories, base protein". 
            // So we just reduce calories. Usually implies reducing carbs/fat.
            // Let's reduce carbs/fat proportionally to the 200 cal.
            // 200 cal ~ 25g carbs + 11g fat roughly. 
            // Or just leave macros as 'limits' and reduce cal. 
            // But UI shows macro targets. 
            // I'll reduce carbs by 30g (120cal) and fat by 9g (81cal) ~ 200cal.
            targetCarbs -= 30;
            targetFat -= 9;
        }
        // LEG DAY (High demand)
        else if (type === 'legs' || emphasis.includes('quads') || emphasis.includes('hamstrings') || emphasis.includes('glutes')) {
            targetCarbs += 50;
            targetProtein += 20;
            targetCalories += (50 * 4) + (20 * 4); // +280 cal
        }
        // CARDIO
        else if (type === 'cardio' || emphasis.includes('cardio')) {
            targetCalories -= 100;
            // Reduce carbs slightly
            targetCarbs -= 25;
        }
        // STRENGTH (Push/Pull, Upper/Lower, etc)
        else {
            targetProtein += 20;
            targetCalories += (20 * 4); // +80 cal
        }
    }

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

    const result = await query(
        `SELECT 
            DATE(created_at) as date,
            SUM(calories) as calories,
            SUM(protein) as protein,
            SUM(carbs) as carbs,
            SUM(fat) as fat
         FROM calorie_logs
         WHERE user_id = $1 
           AND created_at > CURRENT_DATE - INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [userId]
    );

    res.json({ history: result.rows });
}));

module.exports = router;
