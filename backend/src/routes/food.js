/**
 * Food API Routes
 * Priority: Indian Foods > USDA > FatSecret
 */

const express = require('express');
const router = express.Router();
const indianFood = require('../services/indianFood');
const usda = require('../services/usda');
const fatsecret = require('../services/fatsecret');
const { asyncHandler } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/food/search
 * Search for foods - prioritizes Indian foods, then USDA, then FatSecret
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
    const { q, page = 0, limit = 20 } = req.query;

    console.log('🔍 Food search:', q);

    if (!q || q.trim().length === 0) {
        return res.json({ foods: [], total: 0, page: 0, source: null });
    }

    const query = q.trim();
    const pageSize = parseInt(limit);

    // First: Search Indian foods (instant, local)
    const indianResults = indianFood.searchFoods(query, 10);

    // Second: Try USDA API
    let usdaResults = { foods: [] };
    try {
        usdaResults = await usda.searchFoods(query, pageSize - indianResults.foods.length, 1);
        console.log('✅ USDA:', usdaResults.foods?.length, 'foods');
    } catch (error) {
        console.error('❌ USDA failed:', error.message);
    }

    // Combine results: Indian first, then USDA
    const combinedFoods = [
        ...indianResults.foods.map(f => ({ ...f, source: 'indian' })),
        ...usdaResults.foods.map(f => ({ ...f, source: 'usda' })),
    ].slice(0, pageSize);

    console.log('📊 Total results:', combinedFoods.length,
        `(${indianResults.foods.length} Indian, ${usdaResults.foods?.length || 0} USDA)`);

    return res.json({
        foods: combinedFoods,
        total: combinedFoods.length,
        page: 0,
        sources: {
            indian: indianResults.foods.length,
            usda: usdaResults.foods?.length || 0,
        }
    });
}));

/**
 * GET /api/food/:id
 * Get detailed food info with nutrition facts
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { source = 'indian' } = req.query;

    console.log('📦 Food details:', id, source);

    try {
        // Check if it's an Indian food ID
        if (id.startsWith('ind_') || source === 'indian') {
            const food = indianFood.getFoodDetails(id);
            return res.json({ ...food, source: 'indian' });
        }

        // Otherwise try USDA
        const food = await usda.getFoodDetails(id);
        return res.json({ ...food, source: 'usda' });
    } catch (error) {
        console.error('❌ Food details error:', error.message);
        return res.status(404).json({ error: 'Food not found' });
    }
}));

/**
 * GET /api/food/categories/indian
 * Get Indian food categories
 */
router.get('/categories/indian', authenticate, asyncHandler(async (req, res) => {
    const categories = [
        { id: 'bread', name: 'Breads', icon: '🫓' },
        { id: 'grains', name: 'Rice & Grains', icon: '🍚' },
        { id: 'lentils', name: 'Lentils & Dal', icon: '🥘' },
        { id: 'vegetarian', name: 'Vegetarian', icon: '🥗' },
        { id: 'non-veg', name: 'Non-Veg', icon: '🍗' },
        { id: 'south indian', name: 'South Indian', icon: '🥞' },
        { id: 'snacks', name: 'Snacks', icon: '🍘' },
        { id: 'sweets', name: 'Sweets', icon: '🍮' },
        { id: 'dairy', name: 'Dairy', icon: '🥛' },
        { id: 'gym', name: 'Gym Foods', icon: '💪' },
    ];

    res.json({ categories });
}));

/**
 * GET /api/food/gym-foods
 * Get high-protein gym-friendly foods
 */
router.get('/gym-foods', authenticate, asyncHandler(async (req, res) => {
    const foods = indianFood.getGymFoods();
    res.json({
        foods: foods.map(f => ({
            id: f.id,
            name: f.name,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            servingSize: f.servingSize,
        }))
    });
}));

module.exports = router;
