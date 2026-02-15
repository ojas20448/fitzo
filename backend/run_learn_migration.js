// Run Learn Content Migration - With schema update
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('✅ Connected to database');

        // First, add the content column if it doesn't exist
        console.log('Adding content column...');
        await client.query(`
            ALTER TABLE learn_lessons 
            ADD COLUMN IF NOT EXISTS content TEXT
        `);
        console.log('✅ Content column ready');

        // Delete existing lessons and attempts
        console.log('Clearing old lessons...');
        await client.query('DELETE FROM learn_attempts');
        await client.query('DELETE FROM learn_lessons');

        console.log('Reading migration file...');
        const sql = fs.readFileSync('./src/db/migrate_learn_content.sql', 'utf8');

        // Execute the entire file
        console.log('Running migration...');
        await client.query(sql);

        console.log('✅ Migration completed!');

        // Verify
        const result = await client.query('SELECT COUNT(*) as count FROM learn_lessons');
        console.log(`📚 Total lessons: ${result.rows[0].count}`);

        const units = await client.query('SELECT DISTINCT unit, unit_title FROM learn_lessons ORDER BY unit');
        console.log('\n📖 Units created:');
        units.rows.forEach(u => console.log(`  Unit ${u.unit}: ${u.unit_title}`));

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.position) {
            console.error('Error at position:', error.position);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
