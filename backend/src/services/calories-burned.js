const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'calories-burned-by-api-ninjas.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Calculate calories burned for an activity
 */
async function calculateCaloriesBurned(activity, duration = 60, weight = 70) {
    try {
        const response = await axios.get(`${BASE_URL}/v1/caloriesburned`, {
            params: {
                activity: activity,
                weight: weight, // in kg
                duration: duration // in minutes
            },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });

        // API returns array of calorie estimates
        return response.data;
    } catch (error) {
        console.error('Calories burned API error:', error.response?.data || error.message);

        // Fallback: simple MET-based calculation if API fails
        return fallbackCalculation(activity, duration, weight);
    }
}

/**
 * Fallback calculation using MET values
 */
function fallbackCalculation(activity, duration, weight) {
    // Common MET values (Metabolic Equivalent of Task)
    const metValues = {
        'running': 8.0,
        'cycling': 6.0,
        'swimming': 7.0,
        'walking': 3.5,
        'weight lifting': 5.0,
        'yoga': 3.0,
        'hiking': 6.0,
        'basketball': 6.5,
        'soccer': 7.0,
        'tennis': 7.0,
        'dancing': 4.5,
        'rowing': 8.0,
        'default': 5.0
    };

    const met = metValues[activity.toLowerCase()] || metValues.default;
    const caloriesPerMinute = (met * 3.5 * weight) / 200;
    const totalCalories = Math.round(caloriesPerMinute * duration);

    return [{
        name: activity,
        calories_per_hour: Math.round(caloriesPerMinute * 60),
        duration_minutes: duration,
        total_calories: totalCalories
    }];
}

module.exports = {
    calculateCaloriesBurned
};
