require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'a2fd290823msh7ac3463cfd94a54p102f99jsn08cf65848b9a';
const RAPIDAPI_HOST = 'dietagram.p.rapidapi.com';

async function testDietagram() {
    console.log('🧪 Testing Dietagram API...');

    // Test 1: Barcode Lookup
    try {
        const barcode = '4019300005154'; // From user example
        console.log(`\nTest 1: Barcode [${barcode}]`);
        const res = await axios.get(`https://${RAPIDAPI_HOST}/apiBarcode.php`, {
            params: { name: barcode },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        console.log('✅ Status:', res.status);
        console.log('📦 Data:', JSON.stringify(res.data, null, 2).substring(0, 300) + '...');
    } catch (e) {
        console.error('❌ Barcode failed:', e.message);
        if (e.response) console.error(e.response.data);
    }

    // Test 2: Name Search
    try {
        const query = 'oreo';
        console.log(`\nTest 2: Name Search [${query}]`);
        // User said "Find ... by food name", verify if apiBarcode.php accepts name
        const res = await axios.get(`https://${RAPIDAPI_HOST}/apiBarcode.php`, {
            params: { name: query },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        console.log('✅ Status:', res.status);
        console.log('📦 Data:', JSON.stringify(res.data, null, 2).substring(0, 300) + '...');
    } catch (e) {
        console.error('❌ Name search failed:', e.message);
    }
}

testDietagram();
