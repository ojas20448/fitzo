/**
 * USDA FoodData Central API Service
 * Simple API key authentication
 * https://fdc.nal.usda.gov/api-guide.html
 */

const https = require('https');

const API_KEY = process.env.USDA_API_KEY;
const BASE_URL = 'api.nal.usda.gov';

/**
 * Search foods in USDA database
 * @param {string} query - Search query
 * @param {number} pageSize - Results per page (default 20)
 * @param {number} pageNumber - Page number (1-indexed)
 */
async function searchFoods(query, pageSize = 20, pageNumber = 1) {
    if (!API_KEY) {
        throw new Error('USDA API key not configured');
    }

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            query: query,
            pageSize: pageSize,
            pageNumber: pageNumber,
            dataType: ['Branded', 'Survey (FNDDS)', 'Foundation', 'SR Legacy'],
        });

        const options = {
            hostname: BASE_URL,
            port: 443,
            path: `/fdc/v1/foods/search?api_key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.foods) {
                        const results = json.foods.map(food => ({
                            id: food.fdcId.toString(),
                            name: food.description,
                            brand: food.brandOwner || food.brandName || null,
                            type: food.dataType,
                            description: buildDescription(food),
                            // Include basic nutrients directly
                            calories: getNutrientValue(food.foodNutrients, 'Energy') ||
                                getNutrientValue(food.foodNutrients, 'Calories'),
                            protein: getNutrientValue(food.foodNutrients, 'Protein'),
                            carbs: getNutrientValue(food.foodNutrients, 'Carbohydrate, by difference'),
                            fat: getNutrientValue(food.foodNutrients, 'Total lipid (fat)'),
                        }));

                        resolve({
                            foods: results,
                            total: json.totalHits || results.length,
                            page: pageNumber,
                        });
                    } else {
                        resolve({ foods: [], total: 0, page: 1 });
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Get detailed food info
 * @param {string} fdcId - USDA FDC ID
 */
async function getFoodDetails(fdcId) {
    if (!API_KEY) {
        throw new Error('USDA API key not configured');
    }

    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            port: 443,
            path: `/fdc/v1/food/${fdcId}?api_key=${API_KEY}`,
            method: 'GET',
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const food = JSON.parse(data);
                    if (food.fdcId) {
                        // Build serving info
                        const servingSize = food.servingSize || 100;
                        const servingUnit = food.servingSizeUnit || 'g';
                        const householdServing = food.householdServingFullText || `${servingSize}${servingUnit}`;

                        // Get nutrients
                        const nutrients = food.foodNutrients || [];
                        const calories = getNutrientValue(nutrients, 'Energy') ||
                            getNutrientValue(nutrients, 'Calories') || 0;
                        const protein = getNutrientValue(nutrients, 'Protein') || 0;
                        const carbs = getNutrientValue(nutrients, 'Carbohydrate, by difference') || 0;
                        const fat = getNutrientValue(nutrients, 'Total lipid (fat)') || 0;
                        const fiber = getNutrientValue(nutrients, 'Fiber, total dietary') || 0;
                        const sugar = getNutrientValue(nutrients, 'Sugars, total including NLEA') ||
                            getNutrientValue(nutrients, 'Total Sugars') || 0;
                        const sodium = getNutrientValue(nutrients, 'Sodium, Na') || 0;
                        const saturatedFat = getNutrientValue(nutrients, 'Fatty acids, total saturated') || 0;
                        const cholesterol = getNutrientValue(nutrients, 'Cholesterol') || 0;

                        resolve({
                            id: food.fdcId.toString(),
                            name: food.description,
                            brand: food.brandOwner || food.brandName || null,
                            type: food.dataType,
                            servings: [
                                {
                                    id: 'default',
                                    description: householdServing,
                                    measurementDescription: householdServing,
                                    metricAmount: servingSize,
                                    metricUnit: servingUnit,
                                    calories: calories,
                                    protein: protein,
                                    carbs: carbs,
                                    fat: fat,
                                    fiber: fiber,
                                    sugar: sugar,
                                    sodium: sodium,
                                    saturatedFat: saturatedFat,
                                    cholesterol: cholesterol,
                                },
                                // Add per 100g serving if different
                                ...(servingSize !== 100 ? [{
                                    id: 'per100g',
                                    description: '100g',
                                    measurementDescription: '100 grams',
                                    metricAmount: 100,
                                    metricUnit: 'g',
                                    calories: Math.round(calories * 100 / servingSize),
                                    protein: Math.round(protein * 100 / servingSize * 10) / 10,
                                    carbs: Math.round(carbs * 100 / servingSize * 10) / 10,
                                    fat: Math.round(fat * 100 / servingSize * 10) / 10,
                                    fiber: Math.round(fiber * 100 / servingSize * 10) / 10,
                                    sugar: Math.round(sugar * 100 / servingSize * 10) / 10,
                                    sodium: Math.round(sodium * 100 / servingSize),
                                    saturatedFat: Math.round(saturatedFat * 100 / servingSize * 10) / 10,
                                    cholesterol: Math.round(cholesterol * 100 / servingSize),
                                }] : []),
                            ],
                        });
                    } else {
                        reject(new Error('Food not found'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Helper to extract nutrient value by name
 */
function getNutrientValue(nutrients, name) {
    if (!nutrients) return null;
    const nutrient = nutrients.find(n =>
        n.nutrientName === name ||
        n.name === name ||
        (n.nutrient && n.nutrient.name === name)
    );
    if (nutrient) {
        return parseFloat(nutrient.value || nutrient.amount) || 0;
    }
    return null;
}

/**
 * Build description string from food data
 */
function buildDescription(food) {
    const nutrients = food.foodNutrients || [];
    const cal = getNutrientValue(nutrients, 'Energy') || getNutrientValue(nutrients, 'Calories');
    if (cal) {
        return `Calories: ${Math.round(cal)}kcal`;
    }
    return '';
}

module.exports = {
    searchFoods,
    getFoodDetails,
};
