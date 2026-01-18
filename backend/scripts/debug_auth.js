const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testAuth() {
    try {
        const email = 'rahul@example.com';
        const password = 'test123';

        console.log(`Testing auth for: ${email}`);

        // 1. Fetch user from DB
        const result = await pool.query(
            'SELECT id, email, password_hash, name FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            console.log('❌ User not found in DB!');
            return;
        }

        const user = result.rows[0];
        console.log('✅ User found:', user.email);
        console.log('   Stored Hash:', user.password_hash);

        // 2. Compare password
        console.log(`   Comparing password: "${password}"`);
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (isValid) {
            console.log('✅ MATCH! The password is correct according to bcrypt.');
        } else {
            console.log('❌ NO MATCH! The password provided does not match the stored hash.');

            // Generate a NEW hash for test123 to see what it looks like
            const newHash = await bcrypt.hash(password, 10);
            console.log('   Here is a FRESH hash for "test123":', newHash);
            console.log('   Try updating the seed or database with this new hash if the old one is bad.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

testAuth();
