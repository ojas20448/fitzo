const axios = require('axios');

async function testMcAlooDirect() {
    console.log('🧪 Testing AI with "McAloo Tikki Burger" (Direct RapidAPI)...\n');

    const text = "McAloo Tikki Burger with cheese and medium fries";
    console.log(`Input: "${text}"`);

    try {
        const response = await axios.get('https://ai-nutritional-facts.p.rapidapi.com/getNutritionalInfo', {
            params: { text },
            headers: {
                'x-rapidapi-host': 'ai-nutritional-facts.p.rapidapi.com',
                'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
            }
        });

        console.log('✅ Status:', response.status);
        console.log('📦 Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

testMcAlooDirect();
