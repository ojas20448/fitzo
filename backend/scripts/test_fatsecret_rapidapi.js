const axios = require('axios');

async function testFatSecretRapid() {
    console.log('Testing FatSecret RapidAPI...');

    // method=foods.search is likely what we want, the user gave recipe.get.v2 example
    // I'll try searching for "mc aloo tikki"
    const query = 'mc aloo tikki';

    try {
        const response = await axios.get('https://fatsecret4.p.rapidapi.com/rest/server.api', {
            params: {
                method: 'foods.search',
                search_expression: query,
                format: 'json'
            },
            headers: {
                'x-rapidapi-host': 'fatsecret4.p.rapidapi.com',
                'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
            }
        });

        console.log('✅ Status:', response.status);
        console.log('📦 Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testFatSecretRapid();
