const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, NotFoundError } = require('../utils/errors');

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
    const splitResult = await query(
        `SELECT * FROM published_splits WHERE id = $1`,
        [id]
    );

    if (splitResult.rows.length === 0) {
        throw new NotFoundError('Split not found');
    }

    const split = splitResult.rows[0];

    // 2. Increment download count
    await query(
        `UPDATE published_splits SET download_count = download_count + 1 WHERE id = $1`,
        [id]
    );

    // 3. Deactivate current active split
    await query(
        `UPDATE user_splits SET is_active = false WHERE user_id = $1`,
        [userId]
    );

    // 4. Save as user split
    // Extract days from program_structure (JSON)
    // Structure: { "Day 1": "Push", "Day 2": "Pull" }
    // We need to convert this to an array of day names for the user_splits table if needed, OR store the full structure.
    // The user_splits table has `days TEXT[]` which usually stores ["Monday", ...]. 
    // But here we are adopting a program structure.
    // Let's adapt the user_splits table or reuse the logic.
    // For now, let's assume we map the "Day 1", "Day 2" to generic days and the user assigns them later.
    // Or simpler: We save this split as a new reference type.

    // Actually, looking at user_splits table:
    // split_id VARCHAR(50) -- 'ppl_6' etc
    // days TEXT[] -- array of day names
    // It seems user_splits was designed for preset patterns.
    // For adopted splits, we might need to be flexible.

    // Let's Just insert it as a 'custom' split for now but with the published data
    // OR ideally we should store the `program_structure` in user_splits too.

    // For MVP: Let's just create a user_split entry with the name and basic days array
    const dayNames = Object.values(split.program_structure);
    // This gives ["Push", "Pull", "Legs"] etc.

    const newSplit = await query(
        `INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [
            userId,
            'adopted_' + split.id, // distinct ID 
            split.name,
            dayNames,
            split.days_per_week
        ]
    );

    // 4. Award XP? Sure
    await query(`UPDATE users SET xp_points = xp_points + 5 WHERE id = $1`, [userId]);

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
