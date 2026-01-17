const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'dietagram.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Look up food by barcode
 */
async function lookupBarcode(barcode) {
    try {
        const response = await axios.get(`${BASE_URL}/apiBarcode.php`, {
            params: { name: barcode },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });

        return response.data;
    } catch (error) {
        console.error('Barcode lookup error:', error.response?.data || error.message);
        throw new Error('Failed to lookup barcode');
    }
}

/**
 * Format barcode response to match our food structure
 */
function formatBarcodeFood(apiResponse) {
    // The Dietagram API typically returns product info
    if (!apiResponse || !apiResponse.product_name) {
        throw new Error('Product not found for this barcode');
    }

    return {
        name: apiResponse.product_name,
        brand: apiResponse.brand || 'Unknown',
        calories: parseFloat(apiResponse.energy_kcal_100g) || 0,
        protein_g: parseFloat(apiResponse.proteins_100g) || 0,
        carbs_g: parseFloat(apiResponse.carbohydrates_100g) || 0,
        fat_g: parseFloat(apiResponse.fat_100g) || 0,
        serving_size: '100g',
        serving_description: apiResponse.serving_size || '100g',
        fiber_g: parseFloat(apiResponse.fiber_100g) || 0,
        sodium_mg: parseFloat(apiResponse.sodium_100g) || 0,
        sugar_g: parseFloat(apiResponse.sugars_100g) || 0,
        barcode: apiResponse.code,
        source: 'barcode'
    };
}

module.exports = {
    lookupBarcode,
    formatBarcodeFood
};
