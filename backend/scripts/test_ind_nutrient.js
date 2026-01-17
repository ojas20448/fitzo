const axios = require('axios');

async function testIndNutrient() {
    console.log('Testing IND Nutrient API...');

    const headers = {
        'x-rapidapi-host': 'ind-nutrient-api1.p.rapidapi.com',
        'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
    };

    // 1. Test the specific ID provided
    const testId = '646e44df0e77ec175b88cf32';
    console.log(`\nFetching Food ID: ${testId}...`);
    try {
        const response = await axios.get(`https://ind-nutrient-api1.p.rapidapi.com/food/${testId}`, { headers });
        console.log('✅ ID Status:', response.status);
        console.log('📦 ID Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ ID Error:', error.message);
        if (error.response) console.error(error.response.data);
    }

    // 2. Try to find a search endpoint
    // Common patterns: /search, /food/search, /foods
    const query = 'tikki';
    console.log(`\nAttempting Search for "${query}"...`);

    try {
        // Guessing search endpoint based on common REST patterns
        // User provided /food/{id}, so maybe /food/search?query=... or /foods?
        // Let's try a few
        const searchUrl = 'https://ind-nutrient-api1.p.rapidapi.com/food';
        // Note: RapidAPI usually documents the endpoints. I'll blindly try /search first if the base /food + params doesn't work.
        // Actually, often it's GET /food/search 

        const response = await axios.get('https://ind-nutrient-api1.p.rapidapi.com/food/search', {
            params: { title: query }, // 'title' or 'query' or 'q'
            headers
        });

        console.log('✅ Search Status:', response.status);
        console.log('📦 Search Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('ℹ️ Standard Search (/food/search) failed:', error.message);
        // Try another common pattern if needed, but let's stick to simple first.
    }
}

testIndNutrient();
