/**
 * Indian Food Database Service
 * Local database of common Indian foods with accurate nutritional data
 */

const indianFoods = require('../data/indian-foods.json');

/**
 * Search Indian foods by name
 * @param {string} query - Search query
 * @param {number} limit - Max results
 */
function searchFoods(query, limit = 20) {
    const searchTerm = query.toLowerCase();
    const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

    // Score each food for relevance
    const scored = indianFoods.map(food => {
        const name = food.name.toLowerCase();
        const category = food.category.toLowerCase();
        const region = food.region.toLowerCase();
        const searchable = `${name} ${category} ${region}`;
        let score = 0;

        // Exact substring match on name (highest priority)
        if (name.includes(searchTerm)) score += 10;
        // Category or region match
        if (category.includes(searchTerm) || region.includes(searchTerm)) score += 5;
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
            brand: food.category,
            type: 'Indian',
            description: `${food.servingSize} - ${food.calories}kcal | P: ${food.protein}g | C: ${food.carbs}g | F: ${food.fat}g`,
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
    const food = indianFoods.find(f => f.id === foodId);

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
