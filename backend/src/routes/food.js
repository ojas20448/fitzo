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
const { asyncHandler } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');

// ... (existing imports)

/**
 * POST /api/food/analyze-text
 * Analyze natural language text to get nutritional info (AI)
 */
router.post('/analyze-text', authenticate, asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text input is required' });
    }

    console.log('🤖 AI Analyzing text:', text);

    try {
        const response = await axios.post('https://ai-nutritional-facts.p.rapidapi.com/getNutritionalInfo',
            { input: text },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': 'ai-nutritional-facts.p.rapidapi.com',
                    'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
                }
            }
        );

        const data = response.data;

        // Map AI response to our format
        const food = {
            name: text.length > 30 ? 'AI Meal Analysis' : text, // Use text as name if short, else generic
            description: data.reasoning || text,
            calories: data['calories in kcal'] || 0,
            protein_g: data['protein in g'] || 0,
            carbs_g: data['total carbohydrate in g'] || 0,
            fat_g: data['total fat in g'] || 0,
            fiber_g: data['dietary fiber in g'] || 0,
            sugar_g: data['total sugars in g'] || 0,
            sodium_mg: data['sodium in mg'] || 0,
            cholesterol_mg: data['cholesterol in mg'] || 0,
            serving_size: '1 meal',
            source: 'ai_text'
        };

        return res.json({ success: true, food });

    } catch (error) {
        console.error('❌ AI Text Analysis failed:', error.message);
        if (error.response) console.error(error.response.data);
        return res.status(502).json({ error: 'AI analysis failed' });
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
const axios = require('axios');

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
    const [indianRes, usdaRes, fatsecretRes, mfpRes] = await Promise.allSettled([
        // 1. Indian Food (Local/Ref)
        new Promise(resolve => resolve(indianFood.searchFoods(query, 10))),

        // 2. USDA API
        usda.searchFoods(query, 5, 1).catch(err => {
            console.error('USDA search failed:', err.message);
            return { foods: [] };
        }),

        // 3. FatSecret API
        fatsecret.searchFoods(query, 0, 5).catch(err => {
            console.error('FatSecret search failed:', err.message);
            return { foods: [] };
        }),

        // 4. MyFitnessPal (RapidAPI)
        axios.get('https://myfitnesspal2.p.rapidapi.com/searchByKeyword', {
            params: { keyword: query, page: page },
            headers: {
                'x-rapidapi-host': 'myfitnesspal2.p.rapidapi.com',
                'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
            }
        }).catch(err => {
            console.error('MFP search failed:', err.message);
            if (err.response) console.error('MFP Status:', err.response.status);
            return { error: true };
        })
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

    // --- Process MFP Results ---
    let mfpFoods = [];
    if (mfpRes.status === 'fulfilled' && !mfpRes.value.error && mfpRes.value.data) {
        try {
            const data = mfpRes.value.data;
            let items = [];
            // Parse different response shapes
            if (Array.isArray(data)) items = data;
            else if (data.items && Array.isArray(data.items)) items = data.items;
            else if (typeof data === 'object') {
                // heuristic: if it has keys that look like IDs
                items = Object.values(data).filter(v => typeof v === 'object' && (v.name || v.title));
            }

            mfpFoods = items.map(item => {
                if (!item) return null;
                const nutri = item.nutrition || {};
                return {
                    id: item.id || Math.random().toString(36),
                    name: item.name || item.title || query,
                    brand_name: item.brand_name || 'Generic',
                    calories: Number(nutri.calories || nutri.Energy || 0),
                    protein_g: Number(nutri.protein || nutri.protein_g || 0),
                    carbs_g: Number(nutri.carbs || nutri.carbohydrates || nutri.carbs_g || 0),
                    fat_g: Number(nutri.fat || nutri.fat_g || 0),
                    serving_size: item.serving_size || '1 serving',
                    verified: item.verified || false,
                    source: 'myfitnesspal'
                };
            }).filter(f => f !== null);
        } catch (e) {
            console.error('Error parsing MFP results:', e.message);
        }
    }

    // Combine all results
    const combinedFoods = [
        ...indianFoods,
        ...mfpFoods,
        ...usdaFoods,
        ...fatsecretFoods
    ];

    console.log(`📊 Aggregated Search: "${q}" -> ${combinedFoods.length} total.`);
    console.log(`   Detailed: Ind=${indianFoods.length}, MFP=${mfpFoods.length}, USDA=${usdaFoods.length}, FS=${fatsecretFoods.length}`);

    return res.json({
        foods: combinedFoods,
        total: combinedFoods.length,
        page: page,
        sources: {
            indian: indianFoods.length,
            myfitnesspal: mfpFoods.length,
            usda: usdaFoods.length,
            fatsecret: fatsecretFoods.length
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
