require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS = [
    'migrate_nutrition_profile.sql',
    'migrate_recipes.sql',
    'migrate_published_splits.sql'
];

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database...');

        for (const file of MIGRATIONS) {
            const filePath = path.join(__dirname, 'src', 'db', file);
            if (fs.existsSync(filePath)) {
                console.log(`\n📜 Running migration: ${file}...`);
                const sql = fs.readFileSync(filePath, 'utf8');
                await client.query(sql);
                console.log(`✅ ${file} applied successfully!`);
            } else {
                console.warn(`⚠️  Warning: ${file} not found at ${filePath}`);
            }
        }

        console.log('\n✨ All migrations completed!');

    } catch (err) {
        console.error('\n❌ Migration error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

runMigrations();
