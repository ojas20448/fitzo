const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const { validateStarterPlan } = require('../utils/starterWorkoutPlan');
const xpService = require('../services/xpService');
const { invalidateContextPack } = require('../services/contextPack');

router.use(authenticate);
const uuid = z.string().uuid();
const difficulty = z.enum(['beginner', 'intermediate', 'advanced']);
const filterSchema = z.object({
    days: z.string().regex(/^[1-7]$/).optional(), difficulty: difficulty.optional(),
    official: z.enum(['true', 'false']).optional(), search: z.string().trim().max(100).optional(),
    sort: z.enum(['most_liked', 'newest', 'most_used']).default('most_liked'),
    page: z.string().regex(/^\d{1,5}$/).default('0'),
}).strict();
const publicColumns = `p.id, p.name, p.description, p.days_per_week, p.difficulty_level,
    p.program_structure, p.tags, p.author_name, p.is_official, p.download_count, p.created_at,
    (p.training_plan IS NOT NULL) AS has_exercises,
    (SELECT COUNT(*)::int FROM published_split_hearts h WHERE h.split_id = p.id) AS heart_count,
    EXISTS(SELECT 1 FROM published_split_hearts h WHERE h.split_id = p.id AND h.user_id = $1) AS liked`;
const parse = (schema, value) => {
    const result = schema.safeParse(value);
    if (!result.success) throw new ValidationError('Check the workout details or filters and try again.');
    return result.data;
};

router.get('/', asyncHandler(async (req, res) => {
    const filters = parse(filterSchema, req.query);
    const values = [req.user.id];
    const where = [];
    const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
    if (filters.days) add('p.days_per_week = ?', Number(filters.days));
    if (filters.difficulty) add('p.difficulty_level = ?', filters.difficulty);
    if (filters.official !== undefined) add('p.is_official = ?', filters.official === 'true');
    if (filters.search) {
        // Treat % and _ as literal characters, rather than wildcard-only searches.
        add("concat_ws(' ', p.name, p.description, p.author_name, array_to_string(p.tags, ' ')) ILIKE ?", `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`);
    }
    const order = { most_liked: 'heart_count DESC, p.created_at DESC', newest: 'p.created_at DESC', most_used: 'p.download_count DESC, heart_count DESC, p.created_at DESC' }[filters.sort];
    values.push(Number(filters.page) * 24);
    const result = await query(`SELECT ${publicColumns} FROM published_splits p
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${order}, p.id ASC LIMIT 25 OFFSET $${values.length}`, values);
    res.json({ splits: result.rows.slice(0, 24), has_more: result.rows.length > 24 });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const result = await query(`SELECT ${publicColumns}, p.training_plan FROM published_splits p WHERE p.id = $2`, [req.user.id, id]);
    if (!result.rows.length) throw new NotFoundError('Workout not found');
    res.json({ split: result.rows[0] });
}));

// Setting the desired state makes retries safe and permits only one heart per account.
router.put('/:id/heart', asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const { liked } = parse(z.object({ liked: z.boolean() }).strict(), req.body);
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT id FROM published_splits WHERE id = $1 FOR UPDATE', [id]);
        if (!found.rows.length) throw new NotFoundError('Workout not found');
        if (liked) await client.query('INSERT INTO published_split_hearts (split_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, req.user.id]);
        else await client.query('DELETE FROM published_split_hearts WHERE split_id = $1 AND user_id = $2', [id, req.user.id]);
        const count = await client.query('SELECT COUNT(*)::int AS heart_count FROM published_split_hearts WHERE split_id = $1', [id]);
        await client.query('COMMIT');
        res.json({ liked, heart_count: count.rows[0].heart_count });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}));

router.post('/:id/adopt', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    let splitResult;
    if (uuid.safeParse(id).success) splitResult = await query('SELECT * FROM published_splits WHERE id = $1', [id]);
    else {
        const nameMap = { ppl_6: 'PPL (6 Day)', ul_4: 'Upper Lower (4 Day)', fb_3: 'Full Body (3 Day)' };
        if (!nameMap[id]) throw new NotFoundError('Workout not found');
        splitResult = await query('SELECT * FROM published_splits WHERE is_official = true AND name ILIKE $1 ORDER BY created_at, id LIMIT 1', [`${nameMap[id]}%`]);
    }
    if (!splitResult.rows.length) throw new NotFoundError('Workout not found');
    const split = splitResult.rows[0];
    const schedule = parse(z.record(z.string(), z.string().trim().min(1).max(100)).refine(value => Object.keys(value).length >= 1 && Object.keys(value).length <= 7), split.program_structure);
    const days = Object.values(schedule);
    const trainingPlan = validateStarterPlan(split.training_plan, days);
    const client = await getClient();
    let newSplit;
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE published_splits SET download_count = download_count + 1 WHERE id = $1', [split.id]);
        await client.query('UPDATE user_splits SET is_active = false WHERE user_id = $1', [userId]);
        newSplit = await client.query(`INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, training_plan, is_active)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, true) RETURNING *`,
        [userId, 'adopted_' + split.id, split.name, days, split.days_per_week, trainingPlan ? JSON.stringify(trainingPlan) : null]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    await invalidateContextPack(userId).catch(() => {});
    await xpService.awardXP(userId, 5, 'workout', split.id).catch(() => {});
    res.json({ success: true, user_split: newSplit.rows[0] });
}));

router.post('/', asyncHandler(async (req, res) => {
    const data = parse(z.object({
        source_split_id: uuid, name: z.string().trim().min(1).max(100),
        description: z.string().trim().min(1).max(1500), difficulty_level: difficulty,
        tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
    }).strict(), req.body);
    const source = await query('SELECT name, days, days_per_week, training_plan FROM user_splits WHERE id = $1 AND user_id = $2', [data.source_split_id, req.user.id]);
    if (!source.rows.length) throw new NotFoundError('Choose one of your saved plans to publish.');
    const split = source.rows[0];
    if (!Array.isArray(split.days) || split.days.length < 1 || split.days.length > 7
        || split.days.some(day => typeof day !== 'string' || !day.trim() || day.length > 100)) throw new ValidationError('Check the days in your saved plan first.');
    const trainingPlan = validateStarterPlan(split.training_plan, split.days);
    const daysPerWeek = split.days.filter(day => !/^(rest|rest day|off|recovery)$/i.test(day.trim())).length;
    if (!daysPerWeek) throw new ValidationError('Your plan needs at least one training day.');
    const author = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const result = await query(`INSERT INTO published_splits
        (name, description, days_per_week, difficulty_level, program_structure, tags, author_name, author_id, source_split_id, training_plan, is_official)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, false)
        ON CONFLICT (author_id, source_split_id) DO NOTHING RETURNING id`,
    [data.name, data.description, daysPerWeek, data.difficulty_level,
        JSON.stringify(Object.fromEntries(split.days.map((day, index) => [`Day ${index + 1}`, day]))),
        [...new Set(data.tags.map(tag => tag.toLowerCase()))], author.rows[0]?.name || 'Community member', req.user.id, data.source_split_id, trainingPlan ? JSON.stringify(trainingPlan) : null]);
    if (!result.rows.length) throw new ConflictError('This plan is already published.');
    res.status(201).json({ split: result.rows[0] });
}));

module.exports = router;
