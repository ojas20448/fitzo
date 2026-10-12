const express = require('express');
const { z } = require('zod');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, ConflictError } = require('../utils/errors');
const { validateStarterPlan } = require('../utils/starterWorkoutPlan');
const { invalidateContextPack } = require('../services/contextPack');
const router = express.Router();

const preferencesSchema = z.object({
    experience: z.enum(['new', 'returning', 'regular']),
    equipment: z.enum(['gym', 'dumbbells', 'bodyweight']),
    session_minutes: z.union([z.literal(20), z.literal(35), z.literal(50)]),
    goal_type: z.enum(['fat_loss', 'maintenance', 'muscle_gain']),
}).strict();
const splitSchema = z.object({
    split_id: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(100),
    days: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    days_per_week: z.number().int().min(1).max(6), training_plan: z.unknown(),
}).strict();
const saveSchema = z.object({
    preferences: preferencesSchema,
    expected_split_id: z.string().uuid().nullable(),
    replacement: splitSchema.optional(), complete_setup: z.boolean().optional(),
}).strict();

// Read tolerates an older schema. Writes deliberately require migration 022.
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const [account, splits, nutrition] = await Promise.all([
        query("SELECT to_jsonb(u)->'training_preferences' AS preferences FROM users u WHERE id = $1", [req.user.id]),
        query('SELECT * FROM user_splits WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC, id DESC LIMIT 1', [req.user.id]),
        query('SELECT goal_type, age FROM nutrition_profiles WHERE user_id = $1', [req.user.id]),
    ]);
    const split = splits.rows[0] || null;
    const stored = account.rows[0]?.preferences;
    const legacy = split?.training_plan?.preferences;
    const preferences = stored || (legacy ? { ...legacy, goal_type: nutrition.rows[0]?.goal_type || null } : null);
    res.json({ preferences, split, age: nutrition.rows[0]?.age ?? null });
}));

router.put('/', authenticate, asyncHandler(async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Choose your goal, experience, equipment and session length.');
    const { preferences, replacement, expected_split_id, complete_setup } = parsed.data;
    const plan = replacement ? validateStarterPlan(replacement.training_plan, replacement.days) : null;
    if (replacement && (!plan || replacement.days_per_week !== replacement.days.length
        || ['experience', 'equipment', 'session_minutes'].some(key => plan.preferences[key] !== preferences[key]))) {
        throw new ValidationError('The preview must match your training preferences and days.');
    }
    const client = await getClient();
    try {
        await client.query('BEGIN');
        // All routine writes share this account lock. A stale preview must never
        // deactivate a newer plan, including a library or custom routine.
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
        const current = await client.query('SELECT * FROM user_splits WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE', [req.user.id]);
        let split = current.rows[0] || null;
        if ((split?.id || null) !== expected_split_id) throw new ConflictError('Your routine changed. Reload it before saving this preview.');
        if (complete_setup && !split) throw new ValidationError('Save your starting routine before finishing setup.');
        if (complete_setup && !replacement) {
            const starting = validateStarterPlan(split.training_plan, split.days);
            if (!starting || ['experience', 'equipment', 'session_minutes'].some(key => starting.preferences[key] !== preferences[key])) {
                throw new ValidationError('Your saved starting routine must match the setup preview.');
            }
        }
        if (replacement) {
            await client.query('UPDATE user_splits SET is_active = false WHERE user_id = $1', [req.user.id]);
            const saved = await client.query(`INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active, training_plan)
                VALUES ($1, $2, $3, $4, $5, true, $6::jsonb) RETURNING *`,
            [req.user.id, replacement.split_id, replacement.name, replacement.days, replacement.days_per_week, JSON.stringify(plan)]);
            split = saved.rows[0];
        }
        await client.query(`UPDATE users SET training_preferences = $2::jsonb,
            onboarding_completed_at = CASE WHEN $3 THEN COALESCE(onboarding_completed_at, NOW()) ELSE onboarding_completed_at END
            WHERE id = $1`, [req.user.id, JSON.stringify(preferences), complete_setup === true]);
        await client.query('COMMIT');
        await invalidateContextPack(req.user.id).catch(() => {});
        res.json({ preferences, split, onboarding_completed: complete_setup === true });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}));

router.delete('/', authenticate, asyncHandler(async (req, res) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
        await client.query('UPDATE users SET training_preferences = NULL WHERE id = $1', [req.user.id]);
        // Preferences are also embedded in earlier starter templates. Clear
        // those suggestions, retaining schedules and all performed workout data.
        await client.query('UPDATE user_splits SET training_plan = NULL, updated_at = NOW() WHERE user_id = $1 AND training_plan IS NOT NULL', [req.user.id]);
        await client.query('COMMIT');
        await invalidateContextPack(req.user.id).catch(() => {});
        res.json({ preferences: null });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}));
module.exports = router;
