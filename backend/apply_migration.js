const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Please provide a migration file path');
    process.exit(1);
}

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        const sql = fs.readFileSync(path.resolve(migrationFile), 'utf8');

        console.log(`Applying migration: ${migrationFile}...`);
        await client.query(sql);
        console.log('✅ Migration applied successfully!');

    } catch (err) {
        console.error('❌ Error applying migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
