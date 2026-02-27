const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

async function testGemini() {
    console.log('Testing Gemini API (Direct Axios)...');

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is missing in .env');
        process.exit(1);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hello" }] }]
        });

        console.log(`✅ Success with ${model}!`);
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error(`❌ Failed to list models:`);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testGemini();
 