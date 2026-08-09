/**
 * Indian Food Database Service
 * Local database of 3000+ Indian foods with accurate nutritional data
 * Covers home-cooked, street food, fast food chains, and packaged products
 */

const indianFoods = require('../data/indian-foods.json');
const { buildServingVariants } = require('../utils/cookingMedium');
const { rankFoods, prepareFoods } = require('../utils/foodSearch');

// Normalized/tokenized once at startup rather than on every keystroke. With
// ~10k rows this is the difference between a search costing ~100ms and ~10ms;
// it is a cache of derived fields, so ranking is bit-identical either way.
const preparedFoods = prepareFoods(indianFoods);

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
    // Relevance lives in utils/foodSearch.js — a pure module with its own
    // tests. The scorer it replaced counted matched words at a flat rate, so
    // "smash burger" surfaced "English Oven Burger Bun" (one word of two) and
    // any typo — "chiken", "burgar" — returned nothing at all.
    const scored = rankFoods(query, preparedFoods, limit);

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

    const baseServing = {
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
    };

    return {
        id: food.id,
        name: food.name,
        brand: food.category,
        type: 'Indian',
        // For cooked dishes this expands to one entry per cooking medium.
        // CalorieLogScreen renders servings[] directly and pre-selects [0].
        servings: buildServingVariants(baseServing, food.category),
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
