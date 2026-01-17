const axios = require('axios');

async function testApiNinjas() {
    const query = '1lb brisket with fries';
    console.log(`Testing API Ninjas with query: "${query}"...`);

    try {
        const response = await axios.get('https://nutrition-by-api-ninjas.p.rapidapi.com/v1/nutrition', {
            params: { query },
            headers: {
                'x-rapidapi-host': 'nutrition-by-api-ninjas.p.rapidapi.com',
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

testApiNinjas();
