require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function fixPasswords() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // Generate a fresh hash for 'test123'
        const hash = await bcrypt.hash('test123', 10);
        console.log('Generated hash:', hash);

        // Update all test users
        const result = await client.query(
            'UPDATE users SET password_hash = $1 RETURNING email',
            [hash]
        );

        console.log('Updated', result.rowCount, 'users');
        result.rows.forEach(row => console.log('  -', row.email));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

fixPasswords();
