require('dotenv').config();
const { query } = require('../src/config/database');

async function findGyms() {
    try {
        console.log('Searching for gyms...');
        const result = await query('SELECT id, name, qr_code FROM gyms LIMIT 5');

        if (result.rows.length === 0) {
            console.log('No gyms found! Creating a demo gym...');
            const insert = await query(`
                INSERT INTO gyms (name, address, qr_code)
                VALUES ('Fitzo Demo Gym', '123 Demo St', 'DEMO_GYM')
                RETURNING id, name, qr_code
            `);
            console.log('Created Demo Gym:', insert.rows[0]);
        } else {
            console.log('Found Gyms:', result.rows);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

findGyms();
