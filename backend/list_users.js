require('dotenv').config();
const { Client } = require('pg');

async function listUsers() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        const res = await client.query('SELECT id, email, name, role FROM users');
        console.log('Users found:', res.rowCount);
        console.table(res.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

listUsers();
