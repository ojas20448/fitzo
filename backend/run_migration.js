require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        const sql = fs.readFileSync(
            path.join(__dirname, 'src', 'db', 'migrate_splits.sql'),
            'utf8'
        );

        console.log('Running split types migration...');
        await client.query(sql);
        console.log('✅ Migration complete!');

    } catch (err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

runMigration();
