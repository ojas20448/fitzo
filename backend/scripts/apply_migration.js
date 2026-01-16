const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    try {
        const sqlPath = path.join(__dirname, '..', 'supabase_setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Cleaning up existing tables...');
        await client.query(`
      DROP TABLE IF EXISTS set_logs CASCADE;
      DROP TABLE IF EXISTS exercise_logs CASCADE;
      DROP TABLE IF EXISTS workout_sessions CASCADE;
      DROP TABLE IF EXISTS user_splits CASCADE;
      DROP TABLE IF EXISTS exercises CASCADE;
      DROP TABLE IF EXISTS workout_logs CASCADE;
      DROP TABLE IF EXISTS calorie_logs CASCADE;
      DROP TABLE IF EXISTS recipes CASCADE;
      DROP TABLE IF EXISTS nutrition_profiles CASCADE;
      DROP TABLE IF EXISTS fitness_profiles CASCADE;
      DROP TABLE IF EXISTS body_measurements CASCADE;
      DROP TABLE IF EXISTS published_splits CASCADE;
    `);

        console.log('Applying migration...');
        await client.query(sql);

        console.log('✅ Migration applied successfully!');
        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
