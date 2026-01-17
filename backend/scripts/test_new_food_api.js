const axios = require('axios');

async function testFoodNutritionInfo() {
    const query = 'mc aloo tikki burger';
    console.log(`Testing Food Nutrition Information API with query: "${query}"...`);

    // Step 1: Search Endpoint (guessing /foods/search or similar based on RapidAPI patterns)
    // The user gave: https://food-nutrition-information.p.rapidapi.com/food/{foodId}
    // I need to find the ID first.
    // Documentation usually suggests /foods?query=... or /foods/search?query=...
    // I'll try /foods/search first.

    try {
        const searchResponse = await axios.get('https://food-nutrition-information.p.rapidapi.com/foods/search', {
            params: { query, pageSize: 1 },
            headers: {
                'x-rapidapi-host': 'food-nutrition-information.p.rapidapi.com',
                'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
            }
        });

        console.log('✅ Search Status:', searchResponse.status);
        console.log('📦 Search Data:', JSON.stringify(searchResponse.data, null, 2));

        if (searchResponse.data && searchResponse.data.length > 0) {
            const foodId = searchResponse.data[0].id; // Adjust based on actual response
            console.log(`\nFound Food ID: ${foodId}. Fetching details...`);

            const detailResponse = await axios.get(`https://food-nutrition-information.p.rapidapi.com/food/${foodId}`, {
                headers: {
                    'x-rapidapi-host': 'food-nutrition-information.p.rapidapi.com',
                    'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
                }
            });

            console.log('✅ Detail Status:', detailResponse.status);
            console.log('📦 Detail Data:', JSON.stringify(detailResponse.data, null, 2));
        }

    } catch (error) {
        console.error('❌ Search Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testFoodNutritionInfo();
