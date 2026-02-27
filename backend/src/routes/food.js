/**
 * Food API Routes
 * Priority: Indian Foods > USDA > FatSecret
 */

const express = require('express');
const router = express.Router();
const indianFood = require('../services/indianFood');
const usda = require('../services/usda');
const fatsecret = require('../services/fatsecret');
const barcodeService = require('../services/barcode');
const geminiService = require('../services/gemini');
const openFoodFacts = require('../services/openFoodFacts');
const apiNinjas = require('../services/apiNinjas');
const { asyncHandler } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { analyzeFoodTextSchema, analyzeFoodPhotoSchema } = require('../schemas');

/**
 * POST /api/food/analyze-text
 * Analyze food from text description using Gemini AI
 */
router.post('/analyze-text', authenticate, validate({ body: analyzeFoodTextSchema }), asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (process.env.NODE_ENV !== 'production') console.log('🤖 AI Food Text Analysis:', text);

    try {
        const food = await geminiService.analyzeFoodFromText(text.trim());
        return res.json({
            success: true,
            food,
            source: 'ai_text'
        });
    } catch (error) {
        console.error('❌ AI Food Text Analysis failed:', error.message);
        return res.status(500).json({
            error: 'Failed to analyze food text',
            message: error.message
        });
    }
}));

/**
 * POST /api/food/analyze-photo
 * Analyze food from photo using Gemini Vision (FREE tier)
 * Accepts base64 image data
 */
router.post('/analyze-photo', authenticate, validate({ body: analyzeFoodPhotoSchema }), asyncHandler(async (req, res) => {
    const { image, mimeType } = req.body;

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await geminiService.analyzeFoodFromPhoto(base64Data, mimeType);

    return res.json({
        success: true,
        items: result.items,
        total: result.total,
        source: 'ai_vision'
    });
}));

/**
 * GET /api/food/search
 * Search for foods - prioritizes Indian foods, then USDA, then FatSecret
 */
// Helper to enforce timeout
const withTimeout = (promise, ms = 5000, name = 'API') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${name} timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([
        promise.then(res => {
            clearTimeout(timeoutId);
            return res;
        }),
        timeoutPromise
    ]);
};

// ... (existing imports)

/**
 * GET /api/food/search
 * Search for foods - prioritizes MyFitnessPal via RapidAPI (TEST MODE)
 */
// Aggregate Search Endpoint
router.get('/search', authenticate, asyncHandler(async (req, res) => {
    const { q, page = 1 } = req.query;

    if (process.env.NODE_ENV !== 'production') console.log('🔍 Food search (Aggregated):', q);

    if (!q || q.trim().length === 0) {
        return res.json({ foods: [], total: 0, page: 0, source: null });
    }

    const query = q.trim();

    // Run all searches in parallel with new APIs
    const [indianRes, usdaRes, fatsecretRes, ninJasRes, offRes] = await Promise.allSettled([
        // 1. Indian Food (Local) - No timeout needed
        new Promise(resolve => resolve(indianFood.searchFoods(query, 10))),

        // 2. USDA API
        withTimeout(usda.searchFoods(query, 5, 1), 5000, 'USDA')
            .catch(err => {
                console.error('USDA search failed:', err.message);
                return { foods: [] };
            }),

        // 3. FatSecret API
        withTimeout(fatsecret.searchFoods(query, 0, 5), 5000, 'FatSecret')
            .catch(err => {
                console.error('FatSecret search failed:', err.message);
                return { foods: [] };
            }),

        // 4. API Ninjas (Natural language nutrition)
        withTimeout(apiNinjas.searchFoods(query), 3000, 'API Ninjas')
            .then(results => ({ foods: results }))
            .catch(err => {
                console.error('API Ninjas search failed:', err.message);
                return { foods: [] };
            }),

        // 5. Open Food Facts (Packaged products & Indian brands)
        withTimeout(openFoodFacts.searchFoods(query, 5), 3000, 'Open Food Facts')
            .then(results => ({ foods: results }))
            .catch(err => {
                console.error('Open Food Facts search failed:', err.message);
                return { foods: [] };
            }),
    ]);


    // --- Process all results ---
    const indianFoods = (indianRes.status === 'fulfilled' && indianRes.value?.foods)
        ? indianRes.value.foods.map(f => ({ ...f, source: 'indian' }))
        : [];

    const usdaFoods = (usdaRes.status === 'fulfilled' && usdaRes.value?.foods)
        ? usdaRes.value.foods.map(f => ({ ...f, source: 'usda' }))
        : [];

    const fatsecretFoods = (fatsecretRes.status === 'fulfilled' && fatsecretRes.value?.foods)
        ? fatsecretRes.value.foods.map(f => ({ ...f, source: 'fatsecret' }))
        : [];

    const ninjasFoods = (ninJasRes.status === 'fulfilled' && ninJasRes.value?.foods)
        ? ninJasRes.value.foods.map(f => ({ ...f, source: 'api_ninjas' }))
        : [];

    const offFoods = (offRes.status === 'fulfilled' && offRes.value?.foods)
        ? offRes.value.foods.map(f => ({ ...f, source: 'open_food_facts' }))
        : [];

    // Combine all results - prioritize by source
    const combinedFoods = [
        ...indianFoods,
        ...offFoods,      // Packaged products/brands
        ...ninjasFoods,   // Natural language nutrition
        ...usdaFoods,
        ...fatsecretFoods
    ];

    if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 Aggregated Search: "${q}" -> ${combinedFoods.length} total. Indian=${indianFoods.length}, OFF=${offFoods.length}, Ninjas=${ninjasFoods.length}, USDA=${usdaFoods.length}, FS=${fatsecretFoods.length}`);
    }

    return res.json({
        foods: combinedFoods,
        total: combinedFoods.length,
        page: page,
        sources: {
            indian: indianFoods.length,
            open_food_facts: offFoods.length,
            api_ninjas: ninjasFoods.length,
            usda: usdaFoods.length,
            fatsecret: fatsecretFoods.length
        }
    });
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

/**
 * GET /api/food/:id
 * Get detailed food info with nutrition facts
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { source = 'indian' } = req.query;

    if (process.env.NODE_ENV !== 'production') console.log('📦 Food details:', id, source);

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

// Legacy analyze-photo endpoint removed — using Gemini Vision above

/**
 * POST /api/food/barcode
 * Look up food by barcode
 */
router.post('/barcode', authenticate, asyncHandler(async (req, res) => {
    const { barcode } = req.body;

    if (process.env.NODE_ENV !== 'production') console.log('🔍 Barcode lookup:', barcode);

    if (!barcode || barcode.trim().length === 0) {
        return res.status(400).json({
            error: 'barcode is required',
            message: 'Please provide a barcode to look up'
        });
    }

    try {
        const rawResult = await barcodeService.lookupBarcode(barcode);
        if (process.env.NODE_ENV !== 'production') console.log('📦 Product found');

        const formattedFood = barcodeService.formatBarcodeFood(rawResult);

        res.json({
            success: true,
            food: formattedFood,
            source: 'barcode'
        });
    } catch (error) {
        console.error('❌ Barcode lookup failed:', error.message);
        res.status(500).json({
            error: 'Failed to lookup barcode',
            message: error.message
        });
    }
}));

module.exports = router;
