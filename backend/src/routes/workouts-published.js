const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, NotFoundError } = require('../utils/errors');
const xpService = require('../services/xpService');
const { invalidateContextPack } = require('../services/contextPack');

// All routes require authentication
router.use(authenticate);

// ============================================
// GET PUBLISHED SPLITS
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const { days, difficulty, official } = req.query;

    let queryText = `
        SELECT * FROM published_splits 
        WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    if (days) {
        queryText += ` AND days_per_week = $${paramCount}`;
        queryParams.push(parseInt(days));
        paramCount++;
    }

    if (difficulty) {
        queryText += ` AND difficulty_level = $${paramCount}`;
        queryParams.push(difficulty);
        paramCount++;
    }

    if (official === 'true') {
        queryText += ` AND is_official = true`;
    }

    queryText += ` ORDER BY is_official DESC, download_count DESC`;

    const result = await query(queryText, queryParams);

    res.json({ splits: result.rows });
}));

// ============================================
// GET SPLIT DETAILS
// ============================================
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT * FROM published_splits WHERE id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Split not found');
    }

    res.json({ split: result.rows[0] });
}));

// ============================================
// ADOPT SPLIT (Save as User Split)
// ============================================
router.post('/:id/adopt', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    // 1. Get the published split
    let splitResult;

    // Check if ID is a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    if (isUUID) {
        splitResult = await query(
            `SELECT * FROM published_splits WHERE id = $1`,
            [id]
        );
    } else {
        // Handle presets used in onboarding
        const nameMap = {
            'ppl_6': 'PPL (6 Day)',
            'ul_4': 'Upper Lower (4 Day)',
            'fb_3': 'Full Body (3 Day)'
        };
        const searchName = nameMap[id] || id;
        splitResult = await query(
            `SELECT * FROM published_splits WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 1`,
            [`%${searchName}%`, `${id}%`]
        );
    }

    if (splitResult.rows.length === 0) {
        throw new NotFoundError('Split not found');
    }

    const split = splitResult.rows[0];

    const client = await getClient();
    let newSplit;
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        await client.query('UPDATE published_splits SET download_count = download_count + 1 WHERE id = $1', [split.id]);
        await client.query('UPDATE user_splits SET is_active = false WHERE user_id = $1', [userId]);
        newSplit = await client.query(`INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active)
            VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
        [userId, 'adopted_' + split.id, split.name, Object.values(split.program_structure), split.days_per_week]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    await invalidateContextPack(userId).catch(() => {});
    // A non-critical reward failure must not invite a repeat adoption after the
    // routine transaction has already succeeded.
    await xpService.awardXP(userId, 5, 'workout', split.id).catch(() => {});

    res.json({
        success: true,
        message: 'Split adopted successfully',
        user_split: newSplit.rows[0]
    });
}));



// ============================================
// PUBLISH NEW SPLIT
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, description, days_per_week, difficulty_level, program_structure, tags } = req.body;

    // Get author name
    const userResult = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
    const authorName = userResult.rows[0]?.name || 'Community Member';

    const result = await query(
        `INSERT INTO published_splits 
            (name, description, days_per_week, difficulty_level, program_structure, tags, author_name, is_official)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)
         RETURNING *`,
        [name, description, days_per_week, difficulty_level, program_structure, tags, authorName]
    );

    res.status(201).json({
        message: 'Split published successfully!',
        split: result.rows[0]
    });
}));

module.exports = router;
