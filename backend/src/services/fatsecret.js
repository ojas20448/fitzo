/**
 * FatSecret API Service
 * OAuth 2.0 authentication and food search
 */

const https = require('https');

// Token cache
let accessToken = null;
let tokenExpiry = null;

/**
 * Get OAuth 2.0 access token from FatSecret
 * Uses Client Credentials flow
 */
async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const clientId = process.env.FATSECRET_CLIENT_ID;
    const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('FatSecret credentials not configured');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    return new Promise((resolve, reject) => {
        const postData = 'grant_type=client_credentials&scope=basic';

        const options = {
            hostname: 'oauth.fatsecret.com',
            port: 443,
            path: '/connect/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.access_token) {
                        accessToken = json.access_token;
                        // Set expiry 5 minutes before actual expiry for safety
                        tokenExpiry = Date.now() + (json.expires_in - 300) * 1000;
                        resolve(accessToken);
                    } else {
                        reject(new Error('Failed to get access token'));
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
 * Search foods in FatSecret database
 * @param {string} query - Search query
 * @param {number} page - Page number (0-indexed)
 * @param {number} maxResults - Max results per page (default 20)
 */
async function searchFoods(query, page = 0, maxResults = 20) {
    const token = await getAccessToken();

    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            method: 'foods.search',
            search_expression: query,
            format: 'json',
            page_number: page.toString(),
            max_results: maxResults.toString(),
        });

        const options = {
            hostname: 'platform.fatsecret.com',
            port: 443,
            path: `/rest/server.api?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.foods && json.foods.food) {
                        // Normalize response - can be object or array
                        const foods = Array.isArray(json.foods.food)
                            ? json.foods.food
                            : [json.foods.food];

                        // Transform to simpler format
                        const results = foods.map(food => ({
                            id: food.food_id,
                            name: food.food_name,
                            brand: food.brand_name || null,
                            type: food.food_type,
                            description: food.food_description,
                            url: food.food_url,
                        }));

                        resolve({
                            foods: results,
                            total: parseInt(json.foods.total_results) || results.length,
                            page: parseInt(json.foods.page_number) || 0,
                        });
                    } else {
                        resolve({ foods: [], total: 0, page: 0 });
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
 * Get detailed food info including full nutrition facts
 * @param {string} foodId - FatSecret food ID
 */
async function getFoodDetails(foodId) {
    const token = await getAccessToken();

    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            method: 'food.get.v4',
            food_id: foodId,
            format: 'json',
        });

        const options = {
            hostname: 'platform.fatsecret.com',
            port: 443,
            path: `/rest/server.api?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.food) {
                        const food = json.food;
                        // Get servings - normalize to array
                        const servings = food.servings?.serving;
                        const servingList = Array.isArray(servings) ? servings : (servings ? [servings] : []);

                        resolve({
                            id: food.food_id,
                            name: food.food_name,
                            brand: food.brand_name || null,
                            type: food.food_type,
                            servings: servingList.map(s => ({
                                id: s.serving_id,
                                description: s.serving_description,
                                measurementDescription: s.measurement_description,
                                metricAmount: parseFloat(s.metric_serving_amount) || null,
                                metricUnit: s.metric_serving_unit || null,
                                calories: parseFloat(s.calories) || 0,
                                protein: parseFloat(s.protein) || 0,
                                carbs: parseFloat(s.carbohydrate) || 0,
                                fat: parseFloat(s.fat) || 0,
                                fiber: parseFloat(s.fiber) || 0,
                                sugar: parseFloat(s.sugar) || 0,
                                sodium: parseFloat(s.sodium) || 0,
                                saturatedFat: parseFloat(s.saturated_fat) || 0,
                                cholesterol: parseFloat(s.cholesterol) || 0,
                            })),
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

module.exports = {
    getAccessToken,
    searchFoods,
    getFoodDetails,
};
