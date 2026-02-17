/**
 * Food API Routes
 * Priority: Indian Foods > USDA > FatSecret
 */

const express = require('express');
const router = express.Router();
const indianFood = require('../services/indianFood');
const usda = require('../services/usda');
const fatsecret = require('../services/fatsecret');
const foodAnalyzer = require('../services/food-analyzer');
const barcodeService = require('../services/barcode');
const geminiService = require('../services/gemini');
const { asyncHandler } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/food/analyze-text
 * Analyze food from text description using Gemini AI
 */
router.post('/analyze-text', authenticate, asyncHandler(async (req, res) => {
    const { text } = req.body;

    console.log('🤖 AI Food Text Analysis:', text);

    if (!text || text.trim().length === 0) {
        return res.status(400).json({
            error: 'text is required',
            message: 'Please provide a food description to analyze'
        });
    }

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
 * Analyze food image (Mock/Simulation for MVP)
 * To use real AI, integrate OpenAI Vision or Google Cloud Vision here.
 */
router.post('/analyze-photo', authenticate, asyncHandler(async (req, res) => {
    // const { image_url } = req.body;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulated detection result
    // In future: Call AI service here
    const mockFoods = [
        {
            name: 'Grilled Chicken Salad',
            calories: 350,
            protein_g: 45,
            carbs_g: 12,
            fat_g: 15
        },
        {
            name: 'Oatmeal with Berries',
            calories: 280,
            protein_g: 10,
            carbs_g: 45,
            fat_g: 6
        },
        {
            name: 'Avocado Toast',
            calories: 420,
            protein_g: 12,
            carbs_g: 35,
            fat_g: 22
        }
    ];

    // Pick random food for demo variety
    const detectedFood = mockFoods[Math.floor(Math.random() * mockFoods.length)];

    return res.json({
        success: true,
        food: detectedFood
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

    console.log('🔍 Food search (Aggregated):', q);

    if (!q || q.trim().length === 0) {
        return res.json({ foods: [], total: 0, page: 0, source: null });
    }

    const query = q.trim();

    // Run all searches in parallel
    const [indianRes, usdaRes, fatsecretRes] = await Promise.allSettled([
        // 1. Indian Food (Local/Ref) - No timeout needed as it's local
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
    ]);



    // --- Process Indian Results ---
    const indianFoods = (indianRes.status === 'fulfilled' && indianRes.value?.foods)
        ? indianRes.value.foods.map(f => ({ ...f, source: 'indian' }))
        : [];

    // --- Process USDA Results ---
    const usdaFoods = (usdaRes.status === 'fulfilled' && usdaRes.value?.foods)
        ? usdaRes.value.foods.map(f => ({ ...f, source: 'usda' }))
        : [];

    // --- Process FatSecret Results ---
    const fatsecretFoods = (fatsecretRes.status === 'fulfilled' && fatsecretRes.value?.foods)
        ? fatsecretRes.value.foods.map(f => ({ ...f, source: 'fatsecret' }))
        : [];



    // Combine all results
    const combinedFoods = [
        ...indianFoods,

        ...usdaFoods,
        ...fatsecretFoods
    ];

    console.log(`📊 Aggregated Search: "${q}" -> ${combinedFoods.length} total.`);
    console.log(`   Detailed: Ind=${indianFoods.length}, USDA=${usdaFoods.length}, FS=${fatsecretFoods.length}`);

    return res.json({
        foods: combinedFoods,
        total: combinedFoods.length,
        page: page,
        sources: {
            indian: indianFoods.length,

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

/**
 * POST /api/food/analyze-photo
 * Analyze food from photo using AI vision
 */
router.post('/analyze-photo', authenticate, asyncHandler(async (req, res) => {
    const { image_url } = req.body;

    console.log('📸 AI Food Photo Analysis:', image_url);

    if (!image_url || image_url.trim().length === 0) {
        return res.status(400).json({
            error: 'image_url is required',
            message: 'Please provide an image URL to analyze'
        });
    }

    try {
        const rawResult = await foodAnalyzer.analyzeFoodFromImage(image_url);
        console.log('🤖 AI detected:', rawResult);

        const formattedFood = foodAnalyzer.formatFoodAnalysis(rawResult);

        res.json({
            success: true,
            food: formattedFood,
            raw_ai_response: rawResult,
            source: 'ai_vision'
        });
    } catch (error) {
        console.error('❌ AI Food Analysis failed:', error.message);
        res.status(500).json({
            error: 'Failed to analyze food image',
            message: error.message
        });
    }
}));

/**
 * POST /api/food/barcode
 * Look up food by barcode
 */
router.post('/barcode', authenticate, asyncHandler(async (req, res) => {
    const { barcode } = req.body;

    console.log('🔍 Barcode lookup:', barcode);

    if (!barcode || barcode.trim().length === 0) {
        return res.status(400).json({
            error: 'barcode is required',
            message: 'Please provide a barcode to look up'
        });
    }

    try {
        const rawResult = await barcodeService.lookupBarcode(barcode);
        console.log('📦 Product found:', rawResult);

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
