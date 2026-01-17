require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Mock services if file not found (lite version of the test)
const fatsecret = require('../src/services/fatsecret');
const usda = require('../src/services/usda');

async function testAPIs() {
    const results = {
        scan_time: new Date().toISOString(),
        tests: {}
    };

    const query = 'apple';
    console.log(`Testing APIs with query: "${query}"...`);

    // 1. Test MyFitnessPal
    try {
        console.log('Testing MyFitnessPal...');
        const mfpRes = await axios.get('https://myfitnesspal2.p.rapidapi.com/searchByKeyword', {
            params: { keyword: query, page: 1 },
            headers: {
                'x-rapidapi-host': 'myfitnesspal2.p.rapidapi.com',
                'x-rapidapi-key': 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a'
            }
        });
        results.tests.myfitnesspal = {
            status: mfpRes.status,
            data_preview: JSON.stringify(mfpRes.data).substring(0, 200),
            item_count: Array.isArray(mfpRes.data) ? mfpRes.data.length : (mfpRes.data.items ? mfpRes.data.items.length : 0)
        };
    } catch (e) {
        results.tests.myfitnesspal = { error: e.message, response: e.response ? e.response.data : null };
    }

    // 2. Test USDA
    try {
        console.log('Testing USDA...');
        const usdaRes = await usda.searchFoods(query, 5);
        results.tests.usda = {
            success: true,
            item_count: usdaRes.foods ? usdaRes.foods.length : 0
        };
    } catch (e) {
        results.tests.usda = { error: e.message };
    }

    // 3. Test FatSecret
    try {
        console.log('Testing FatSecret...');
        const fsRes = await fatsecret.searchFoods(query, 0, 5);
        results.tests.fatsecret = {
            success: true,
            item_count: fsRes.foods ? fsRes.foods.length : 0
        };
    } catch (e) {
        results.tests.fatsecret = { error: e.message };
    }

    // Write results
    console.log('Writing results...');
    fs.writeFileSync('api_audit.json', JSON.stringify(results, null, 2));
    console.log('Done! Check api_audit.json');
}

testAPIs();
