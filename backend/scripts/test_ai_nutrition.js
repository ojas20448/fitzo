require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a';
const RAPIDAPI_HOST = 'ai-nutritional-facts.p.rapidapi.com';

async function testAINutrition() {
    console.log('🧪 Testing AI Nutritional Facts API...');

    const input = "McAloo Tikki Burger with cheese and medium fries";

    console.log(`\nInput: "${input}"`);

    try {
        const response = await axios.post(`https://${RAPIDAPI_HOST}/getNutritionalInfo`,
            { input: input },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY
                }
            }
        );

        console.log('✅ Status:', response.status);
        console.log('📦 Data:', JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.error('❌ API failed:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

testAINutrition();
