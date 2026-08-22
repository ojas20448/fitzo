const { query } = require('../config/database');
/**
 * Food API Routes
 * Priority: Indian Foods (local + IFCT2017) > Open Food Facts > API Ninjas > USDA > FatSecret
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const indianFood = require('../services/indianFood');
const ifct2017 = require('../services/ifct2017');
const usda = require('../services/usda');
const fatsecret = require('../services/fatsecret');
const barcodeService = require('../services/barcode');
const geminiService = require('../services/gemini');
const openFoodFacts = require('../services/openFoodFacts');
const apiNinjas = require('../services/apiNinjas');
const foodPrefs = require('../services/foodPrefs');
const communityFoods = require('../services/communityFoods');
const { asyncHandler } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');
const { aiQuota } = require('../middleware/aiQuota');
const { validate } = require('../middleware/validate');
const {
    analyzeFoodTextSchema,
    analyzeFoodPhotoSchema,
    submitCommunityFoodSchema,
    flagCommunityFoodSchema,
} = require('../schemas');

// Per-user limiter for the search/detail/barcode surface — every hit fans out
// to external providers (USDA/FatSecret/API Ninjas/OFF), so it must be capped
// even though it isn't Gemini-backed. Runs after authenticate, keyed on user.
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `food-search:${req.user?.id || req.ip}`,
    message: { error: true, message: 'Too many food searches. Please slow down.', code: 'RATE_LIMITED' },
    skip: () => process.env.NODE_ENV === 'test',
});

/**
 * POST /api/food/analyze-text
 * Analyze food from text description using Gemini AI
 */
router.post('/analyze-text', authenticate, aiQuota, validate({ body: analyzeFoodTextSchema }), asyncHandler(async (req, res) => {
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
// NOTE: the 10mb body limit for this route is declared in src/index.js
// (LARGE_BODY_ROUTES), not here. A route-level express.json() would be a no-op —
// the global parser has already consumed the body by the time we reach it.
router.post('/analyze-photo', authenticate, aiQuota, validate({ body: analyzeFoodPhotoSchema }), asyncHandler(async (req, res) => {
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
router.get('/search', authenticate, searchLimiter, asyncHandler(async (req, res) => {
    const { q, page = 1 } = req.query;

    if (process.env.NODE_ENV !== 'production') console.log('🔍 Food search (Aggregated):', q);

    if (!q || q.trim().length === 0) {
        return res.json({ foods: [], total: 0, page: 0, source: null });
    }

    const query = q.trim();

    // Run all searches in parallel with new APIs
    const [indianRes, ifctRes, usdaRes, fatsecretRes, ninJasRes, offRes, communityRes] = await Promise.allSettled([
        // 1. Indian Food (Local) - No timeout needed
        new Promise(resolve => resolve(indianFood.searchFoods(query, 10))),

        // 2. IFCT2017 (Official Indian govt nutrition data) - No timeout needed
        new Promise(resolve => resolve(ifct2017.searchFoods(query, 8))),

        // 3. USDA API
        withTimeout(usda.searchFoods(query, 5, 1), 5000, 'USDA')
            .catch(err => {
                console.error('USDA search failed:', err.message);
                return { foods: [] };
            }),

        // 4. FatSecret API
        withTimeout(fatsecret.searchFoods(query, 0, 5), 5000, 'FatSecret')
            .catch(err => {
                console.error('FatSecret search failed:', err.message);
                return { foods: [] };
            }),

        // 5. API Ninjas (Natural language nutrition)
        withTimeout(apiNinjas.searchFoods(query), 3000, 'API Ninjas')
            .then(results => ({ foods: results }))
            .catch(err => {
                console.error('API Ninjas search failed:', err.message);
                return { foods: [] };
            }),

        // 6. Open Food Facts (Packaged products & Indian brands)
        withTimeout(openFoodFacts.searchFoods(query, 5), 5000, 'Open Food Facts')
            .then(results => ({ foods: results }))
            .catch(err => {
                console.error('Open Food Facts search failed:', err.message);
                return { foods: [] };
            }),

        // 7. Community submissions (member-contributed, auto-published).
        //    Own database, so a short timeout — if this is slow the whole
        //    search is already in trouble and the curated sources carry it.
        withTimeout(communityFoods.searchFoods(query, 8), 2000, 'Community')
            .catch(err => {
                console.error('Community food search failed:', err.message);
                return { foods: [] };
            }),
    ]);


    // --- Process all results ---
    const indianFoods = (indianRes.status === 'fulfilled' && indianRes.value?.foods)
        ? indianRes.value.foods.map(f => ({ ...f, source: 'indian' }))
        : [];

    const ifctFoods = (ifctRes.status === 'fulfilled' && ifctRes.value?.foods)
        ? ifctRes.value.foods.map(f => ({ ...f, source: 'ifct2017' }))
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

    const communityFoodsList = (communityRes.status === 'fulfilled' && communityRes.value?.foods)
        ? communityRes.value.foods.map(f => ({ ...f, source: 'community' }))
        : [];

    // Combine all results - prioritize Indian sources
    const combinedFoods = [
        ...indianFoods,     // Local Indian foods DB (home-cooked + restaurant chains)
        ...ifctFoods,       // IFCT2017 govt nutrition data (raw ingredients)
        // Members' own additions rank above the foreign generic databases:
        // a dish someone here bothered to add is usually the one someone here
        // is looking for. Still below the curated sets, which are verified.
        ...communityFoodsList,
        ...offFoods,        // Packaged products/brands
        ...ninjasFoods,     // Natural language nutrition
        ...usdaFoods,
        ...fatsecretFoods
    ];

    if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 Aggregated Search: "${q}" -> ${combinedFoods.length} total. Indian=${indianFoods.length}, IFCT=${ifctFoods.length}, Community=${communityFoodsList.length}, OFF=${offFoods.length}, Ninjas=${ninjasFoods.length}, USDA=${usdaFoods.length}, FS=${fatsecretFoods.length}`);
    }

    return res.json({
        foods: combinedFoods,
        total: combinedFoods.length,
        page: page,
        sources: {
            indian: indianFoods.length,
            ifct2017: ifctFoods.length,
            community: communityFoodsList.length,
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

// ===========================================
// COMMUNITY FOOD CATALOG
// The write path into the global database. Auto-publish + flag takedown;
// see services/communityFoods.js and db/migrate_community_foods.sql.
//
// ORDERING: these MUST stay above `GET /:id`. Express matches in definition
// order and `/:id` is greedy — declared first, it would capture
// `GET /community/mine` and try to look up a food called "community".
// ===========================================

// Contributions are cheap to write and permanent for everyone, so this is the
// tightest limit on the router. Keyed on user id only — `authenticate` runs
// first and guarantees it, and falling back to req.ip would let IPv6 clients
// rotate addresses to bypass the cap.
const submitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `food-submit:${req.user.id}`,
    message: {
        error: true,
        message: "You've added a lot of foods this hour. Try again a bit later.",
        code: 'RATE_LIMITED',
    },
    skip: () => process.env.NODE_ENV === 'test',
});

/**
 * POST /api/food/community
 * Add a food to the global catalog. Live in search immediately.
 *
 * 409 carries `existing` when the food is already known, so the client can
 * offer "log that one instead" rather than making the member start over.
 */
router.post(
    '/community',
    authenticate,
    submitLimiter,
    validate({ body: submitCommunityFoodSchema }),
    asyncHandler(async (req, res) => {
        try {
            const food = await communityFoods.submitFood(req.user.id, req.body);
            return res.status(201).json({ success: true, food, source: 'community' });
        } catch (err) {
            if (err.code === 'CONFLICT') {
                return res.status(409).json({
                    error: true,
                    code: 'DUPLICATE_FOOD',
                    message: err.message,
                    existing: err.existing || null,
                });
            }
            throw err;
        }
    })
);

/**
 * GET /api/food/community/mine
 * The member's own submissions, so they can review or withdraw them.
 */
router.get('/community/mine', authenticate, asyncHandler(async (req, res) => {
    const { rows } = await query(
        `SELECT id, name, category, serving_size, calories, protein, carbs, fat,
                status, flag_count, log_count, created_at
           FROM community_foods
          WHERE submitted_by = $1 AND status <> 'removed'
          ORDER BY created_at DESC
          LIMIT 100`,
        [req.user.id]
    );
    return res.json({
        foods: rows.map((r) => ({
            id: `${communityFoods.PREFIX}${r.id}`,
            name: r.name,
            category: r.category,
            servingSize: r.serving_size,
            calories: Number(r.calories),
            protein: Number(r.protein),
            carbs: Number(r.carbs),
            fat: Number(r.fat),
            status: r.status,
            flagCount: r.flag_count,
            logCount: r.log_count,
            createdAt: r.created_at,
        })),
        total: rows.length,
    });
}));

/**
 * POST /api/food/community/:id/flag
 * Report wrong macros. Auto-hides from global search at FLAG_THRESHOLD
 * distinct members — this is the only takedown path members have.
 */
router.post(
    '/community/:id/flag',
    authenticate,
    validate({ body: flagCommunityFoodSchema }),
    asyncHandler(async (req, res) => {
        const result = await communityFoods.flagFood(req.user.id, req.params.id, req.body);
        return res.json({ success: true, ...result });
    })
);

/**
 * DELETE /api/food/community/:id
 * Withdraw your own submission, while nobody else depends on it.
 */
router.delete('/community/:id', authenticate, asyncHandler(async (req, res) => {
    const result = await communityFoods.withdrawFood(req.user.id, req.params.id);
    return res.json({ success: true, ...result });
}));

/**
 * GET /api/food/:id
 * Get detailed food info with nutrition facts
 */
router.get('/:id', authenticate, searchLimiter, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { source = 'indian' } = req.query;

    if (process.env.NODE_ENV !== 'production') console.log('📦 Food details:', id, source);

    try {
        // Community foods first. `source` DEFAULTS to 'indian', so a plain
        // GET /api/food/com_<uuid> with no query string would otherwise fall
        // into the branch below and 404 against the curated catalog.
        if (communityFoods.isCommunityId(id)) {
            const food = await communityFoods.getFoodDetails(id);
            return res.json({ ...food, source: 'community' });
        }

        // Check if it's an Indian food ID
        if (id.startsWith('ind_') || source === 'indian') {
            const food = indianFood.getFoodDetails(id);

            // Put the member's usual choice first — CalorieLogScreen pre-selects [0].
            if (food && Array.isArray(food.servings) && food.servings.length > 1) {
                const preferred = await foodPrefs.getPreferredMedium(req.user.id, food.name);
                if (preferred) {
                    const idx = food.servings.findIndex((s) => s.id === preferred);
                    if (idx > 0) {
                        const [chosen] = food.servings.splice(idx, 1);
                        food.servings.unshift(chosen);
                    }
                }
            }

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

// Legacy analyze-photo endpoint removed — using Gemini Vision above

/**
 * POST /api/food/barcode
 * Look up food by barcode
 */
router.post('/barcode', authenticate, searchLimiter, asyncHandler(async (req, res) => {
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


router.post('/bulk-resolve', authenticate, aiQuota, asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const results = [];
    for (const { item, quantity } of items) {
        const searchQuery = `${quantity} ${item}`.trim();
        const searchRes = indianFood.searchFoods(searchQuery, 1);
        const bestMatch = searchRes.foods && searchRes.foods.length > 0 ? searchRes.foods[0] : null;
        
        if (bestMatch) {
            results.push({ ...bestMatch, is_estimate: false, source: 'catalog', original_query: searchQuery });
        } else {
            const aiEstimated = await geminiService.analyzeFoodFromText(searchQuery);
            // Upsert on (user_id, lower(name)) — the unique index in
            // migrate_user_foods.sql. A plain INSERT here was wrong both ways
            // round: with the index present, the second "2 roti" of the week
            // threw a unique violation and 500'd; without it, a daily log grew
            // 365 near-identical rows. Re-logging now refreshes the estimate,
            // which is what the index was always for.
            const queryRes = await query(
                `INSERT INTO user_foods (user_id, name, calories, protein, carbs, fat)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, lower(name)) DO UPDATE
                    SET calories = EXCLUDED.calories,
                        protein  = EXCLUDED.protein,
                        carbs    = EXCLUDED.carbs,
                        fat      = EXCLUDED.fat
                 RETURNING *`,
                [req.user.id, aiEstimated.name || searchQuery, aiEstimated.calories, aiEstimated.protein_g, aiEstimated.carbs_g, aiEstimated.fat_g]
            );
            results.push({ ...aiEstimated, id: queryRes.rows[0].id, is_estimate: true, source: 'ai_estimate', user_food_id: queryRes.rows[0].id, original_query: searchQuery });
        }
    }
    return res.json({ success: true, items: results });
}));

module.exports = router;
