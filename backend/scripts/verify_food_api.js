const http = require('http');

async function testFoodApi() {
    console.log('Testing Food API...');

    // 1. Login to get token
    const loginData = JSON.stringify({});
    const token = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/dev-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data).token));
        });
        req.end(loginData);
    });

    console.log('Got token:', token ? 'Yes' : 'No');

    // 2. Search Food
    const start = Date.now();
    const result = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/food/search?q=chicken',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data: data }));
        });
        req.on('error', reject);
        req.end();
    });

    console.log(`Time taken: ${Date.now() - start}ms`);
    console.log('Status:', result.status);
    console.log('Body length:', result.data.length);
    console.log('Preview:', result.data.substring(0, 100));
}

testFoodApi().catch(console.error);
