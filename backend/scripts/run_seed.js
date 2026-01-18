const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSeed() {
    try {
        const seedPath = path.join(__dirname, '../src/db/seed.sql');
        console.log(`Reading seed file from: ${seedPath}`);
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        console.log('Cleaning up existing data...');
        await pool.query('TRUNCATE TABLE gyms, users, friendships, attendances, workout_intents, class_sessions, learn_lessons, workout_plans, calorie_plans CASCADE');

        console.log('Executing seed SQL...');
        await pool.query(seedSql);
        console.log('Seed data inserted successfully!');

    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await pool.end();
    }
}

runSeed();
