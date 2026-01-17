const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'ai-food-calorie-counter-nutrition-analyzer-from-photo.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Analyze food from image URL and get nutritional information
 */
async function analyzeFoodFromImage(imageUrl) {
    try {
        const response = await axios.post(
            `${BASE_URL}/imageidentifier.php`,
            {
                image_url: imageUrl,
                referer: '/fitzo-food-logger'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': RAPIDAPI_HOST
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('AI Food Analyzer API error:', error.response?.data || error.message);
        throw new Error('Failed to analyze food image');
    }
}

/**
 * Analyze food from base64 encoded image
 */
async function analyzeFoodFromBase64(base64Image) {
    try {
        // Note: Some APIs require image_url, so we might need to upload to temporary storage
        // For now, returning error prompting for URL-based approach
        throw new Error('Base64 analysis not yet implemented. Please use image URL method.');
    } catch (error) {
        console.error('AI Food Analyzer error:', error.message);
        throw error;
    }
}

/**
 * Format AI response to match our food item structure
 */
function formatFoodAnalysis(apiResponse) {
    // The API typically returns:
    // {
    //   "food_name": "Pizza",
    //   "calories": 266,
    //   "protein": 11.4,
    //   "carbs": 33.3,
    //   "fat": 9.8,
    //   "serving_size": "100g",
    //   // ... other fields
    // }

    if (!apiResponse || !apiResponse.food_name) {
        throw new Error('Invalid API response format');
    }

    return {
        name: apiResponse.food_name,
        brand: 'AI Detected',
        calories: parseFloat(apiResponse.calories) || 0,
        protein_g: parseFloat(apiResponse.protein) || 0,
        carbs_g: parseFloat(apiResponse.carbs) || 0,
        fat_g: parseFloat(apiResponse.fat) || 0,
        serving_size: apiResponse.serving_size || '100g',
        serving_description: apiResponse.serving_description || 'AI Estimated',
        fiber_g: parseFloat(apiResponse.fiber) || 0,
        sodium_mg: parseFloat(apiResponse.sodium) || 0,
        sugar_g: parseFloat(apiResponse.sugar) || 0,
        source: 'ai_vision'
    };
}

module.exports = {
    analyzeFoodFromImage,
    analyzeFoodFromBase64,
    formatFoodAnalysis
};
