const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');

// All routes require authentication
router.use(authenticate);

// ============================================
// GET ALL RECIPES
// ============================================
router.get('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const result = await query(
        `SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );
    res.json({ recipes: result.rows });
}));

// ============================================
// GET SINGLE RECIPE
// ============================================
router.get('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const recipeId = req.params.id;

    const result = await query(
        `SELECT * FROM recipes WHERE id = $1 AND user_id = $2`,
        [recipeId, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Recipe not found');
    }

    res.json({ recipe: result.rows[0] });
}));

// ============================================
// CREATE RECIPE
// ============================================
router.post('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        name,
        description,
        instructions,
        ingredients,
        total_calories,
        total_protein,
        total_carbs,
        total_fat
    } = req.body;

    if (!name) {
        throw new ValidationError('Recipe name is required');
    }

    const result = await query(
        `INSERT INTO recipes 
         (user_id, name, description, instructions, ingredients, total_calories, total_protein, total_carbs, total_fat)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            userId,
            name,
            description || '',
            instructions || '',
            JSON.stringify(ingredients || []),
            total_calories || 0,
            total_protein || 0,
            total_carbs || 0,
            total_fat || 0
        ]
    );

    res.json({ success: true, recipe: result.rows[0] });
}));

// ============================================
// UPDATE RECIPE
// ============================================
router.put('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const recipeId = req.params.id;
    const {
        name,
        description,
        instructions,
        ingredients,
        total_calories,
        total_protein,
        total_carbs,
        total_fat
    } = req.body;

    // Check recipe exists and belongs to user
    const checkResult = await query(
        `SELECT id FROM recipes WHERE id = $1 AND user_id = $2`,
        [recipeId, userId]
    );

    if (checkResult.rows.length === 0) {
        throw new NotFoundError('Recipe not found');
    }

    // Update recipe
    const result = await query(
        `UPDATE recipes
         SET name = $1, description = $2, instructions = $3, ingredients = $4,
             total_calories = $5, total_protein = $6, total_carbs = $7, total_fat = $8,
             updated_at = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
        [
            name || '',
            description || '',
            instructions || '',
            JSON.stringify(ingredients || []),
            total_calories || 0,
            total_protein || 0,
            total_carbs || 0,
            total_fat || 0,
            recipeId,
            userId
        ]
    );

    res.json({ success: true, recipe: result.rows[0] });
}));

// ============================================
// DELETE RECIPE
// ============================================
router.delete('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const recipeId = req.params.id;

    const result = await query(
        `DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING id`,
        [recipeId, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Recipe not found');
    }

    res.json({ success: true });
}));

module.exports = router;
