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

    const results = indianFoods.filter(food => {
        const name = food.name.toLowerCase();
        const category = food.category.toLowerCase();
        const region = food.region.toLowerCase();

        return name.includes(searchTerm) ||
            category.includes(searchTerm) ||
            region.includes(searchTerm);
    }).slice(0, limit);

    return {
        foods: results.map(food => ({
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
        total: results.length,
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
