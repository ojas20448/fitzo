const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'fitzo',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'src', 'db', 'migrate_fitness_profile.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running fitness profile migration...');
        await pool.query(sql);
        console.log('Migration successful: Fitness Profile & Measurements tables created.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
