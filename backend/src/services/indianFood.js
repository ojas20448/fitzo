/**
 * Indian Food Database Service
 * Local database of 3000+ Indian foods with accurate nutritional data
 * Covers home-cooked, street food, fast food chains, and packaged products
 */

const indianFoods = require('../data/indian-foods.json');

// Build lookup map for fast ID-based access
const foodById = new Map();
indianFoods.forEach(f => foodById.set(f.id, f));

// Brand categories that should show region as brand name
const BRAND_CATEGORIES = new Set([
    'fast food', 'restaurant', 'beverages', 'desserts',
    'packaged snacks', 'packaged dairy', 'dairy', 'protein',
    'health foods', 'ice cream', 'bakery', 'confectionery',
]);

/**
 * Search Indian foods by name
 * @param {string} query - Search query
 * @param {number} limit - Max results
 */
function searchFoods(query, limit = 25) {
    const searchTerm = query.toLowerCase();
    const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

    // Score each food for relevance
    const scored = indianFoods.map(food => {
        const name = food.name.toLowerCase();
        const category = food.category.toLowerCase();
        const region = food.region.toLowerCase();
        const searchable = `${name} ${category} ${region}`;
        let score = 0;

        // Exact name match (highest priority)
        if (name === searchTerm) score += 20;
        // Exact substring match on name
        else if (name.includes(searchTerm)) score += 10;
        // Name starts with search term
        if (name.startsWith(searchTerm)) score += 5;
        // Brand/region match (e.g. searching "amul" or "mcdonalds")
        // Use word-boundary-aware matching to avoid "roti" matching "protinex"
        const cleanRegion = region.replace(/['\s-]/g, '');
        const cleanSearch = searchTerm.replace(/['\s-]/g, '');
        if (region === searchTerm) score += 7;
        else if (cleanSearch.length >= 4 && cleanRegion.startsWith(cleanSearch)) score += 7;
        // Category match
        if (category.includes(searchTerm)) score += 4;
        // All individual words match (multi-word search like "maggi noodles")
        const allWordsMatch = words.every(w => searchable.includes(w));
        if (allWordsMatch) score += 8;
        // Partial word matches
        const matchingWords = words.filter(w => searchable.includes(w)).length;
        if (matchingWords > 0) score += matchingWords * 2;

        return { food, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return {
        foods: scored.map(({ food }) => ({
            id: food.id,
            name: food.name,
            brand: BRAND_CATEGORIES.has(food.category.toLowerCase())
                ? food.region
                : food.category,
            type: 'Indian',
            description: `Per ${food.servingSize} - Calories: ${food.calories}kcal | Fat: ${food.fat}g | Carbs: ${food.carbs}g | Protein: ${food.protein}g`,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
        })),
        total: scored.length,
        page: 1,
    };
}

/**
 * Get food details by ID
 * @param {string} foodId - Indian food ID
 */
function getFoodDetails(foodId) {
    const food = foodById.get(foodId);

    if (!food) {
        throw new Error('Food not found');
    }

    return {
        id: food.id,
        name: food.name,
        brand: food.category,
        type: 'Indian',
        servings: [
            {
                id: 'default',
                description: food.servingSize,
                measurementDescription: food.servingSize,
                calories: food.calories,
                protein: food.protein,
                carbs: food.carbs,
                fat: food.fat,
                fiber: food.fiber || 0,
                sugar: 0,
                sodium: 0,
                saturatedFat: 0,
                cholesterol: 0,
            }
        ],
    };
}

/**
 * Get all foods by category
 * @param {string} category - Category name
 */
function getFoodsByCategory(category) {
    return indianFoods.filter(f =>
        f.category.toLowerCase() === category.toLowerCase()
    );
}

/**
 * Get gym-friendly foods (high protein)
 */
function getGymFoods() {
    return indianFoods.filter(f =>
        f.region === 'Gym' || f.protein >= 15
    );
}

module.exports = {
    searchFoods,
    getFoodDetails,
    getFoodsByCategory,
    getGymFoods,
};
