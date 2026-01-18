const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkUser() {
    try {
        console.log('Checking for user rahul@example.com...');
        const res = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', ['rahul@example.com']);

        if (res.rows.length > 0) {
            console.log('User found:', res.rows[0]);
        } else {
            console.log('User NOT found.');
        }
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkUser();
