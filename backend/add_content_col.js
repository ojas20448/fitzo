require('dotenv').config();
const { Client } = require('pg');

async function addContentColumn() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // Add content column if it doesn't exist
        await client.query(`
            ALTER TABLE learn_lessons 
            ADD COLUMN IF NOT EXISTS content TEXT;
        `);
        console.log('✅ Added content column to learn_lessons');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

addContentColumn();
