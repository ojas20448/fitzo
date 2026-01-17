require('dotenv').config();
const https = require('https');

// Get credentials from .env
const clientId = process.env.FATSECRET_CLIENT_ID;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

console.log('Credentials present:', !!clientId, !!clientSecret);

async function getAccessToken() {
    if (!clientId || !clientSecret) throw new Error('Missing Credentials');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    return new Promise((resolve, reject) => {
        const postData = 'grant_type=client_credentials&scope=basic';
        const options = {
            hostname: 'oauth.fatsecret.com',
            port: 443,
            path: '/connect/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('Token Response:', data);
                try {
                    const json = JSON.parse(data);
                    if (json.access_token) resolve(json.access_token);
                    else reject(new Error('No access token in response'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function searchFood(token) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            search_expression: 'apple',
            format: 'json',
            max_results: 5
        });

        const options = {
            hostname: 'platform.fatsecret.com',
            port: 443,
            path: '/rest/server.api?method=foods.search.v2&format=json',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('Search Response Status:', res.statusCode);
                console.log('Search Response Body:', data); // Log FULL body
                resolve();
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

(async () => {
    try {
        console.log('Getting Token...');
        const token = await getAccessToken();
        console.log('Got Token. Searching...');
        await searchFood(token);
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
