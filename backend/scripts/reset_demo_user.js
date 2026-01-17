require('dotenv').config();
const { query } = require('../src/config/database');

async function resetDemoUser() {
    try {
        console.log('Resetting demo user...');
        const result = await query("DELETE FROM users WHERE email = 'demo@fitzo.com'");
        console.log('Deleted demo user rows:', result.rowCount);
    } catch (error) {
        console.error('Error:', error);
    }
}

resetDemoUser();
