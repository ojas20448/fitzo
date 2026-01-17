require('dotenv').config();
const axios = require('axios');

async function debugImageFetch() {
    try {
        const id = '0001';
        console.log(`Testing Image Fetch with Headers for ID: ${id}`);

        const urlsToTest = [
            `https://exercisedb.p.rapidapi.com/image/${id}`,
            `https://exercisedb.p.rapidapi.com/image/${parseInt(id, 10)}`,
            `https://exercisedb.p.rapidapi.com/exercises/exercise-image/${id}`
        ];

        for (const url of urlsToTest) {
            try {
                console.log(`Checking: ${url}`);
                const res = await axios.get(url, {
                    headers: {
                        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                        'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
                    },
                    responseType: 'arraybuffer'
                });
                console.log(`  -> Success! Status: ${res.status}`);
            } catch (err) {
                console.log(`  -> Failed: ${err.message}`);
                if (err.response) {
                    console.log(`     Status: ${err.response.status}`);
                    console.log(`     Data: ${err.response.data.toString()}`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugImageFetch();
