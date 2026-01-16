const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    try {
        console.log('Running username migration...');
        const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrate_username.sql'), 'utf8');

        await pool.query(sql);
        console.log('Migration successful: Usernames added.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
