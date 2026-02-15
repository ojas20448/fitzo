require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to DB');

        // Fix intent note length
        console.log('🔧 Fixing workout_intents.note size...');
        await client.query('ALTER TABLE workout_intents ALTER COLUMN note TYPE TEXT');
        console.log('✅ Intent note column updated to TEXT');

        // Verify Learn Content
        const res = await client.query('SELECT COUNT(*) as count FROM learn_lessons');
        console.log(`📚 Learn Lessons Count: ${res.rows[0].count}`);

        // Verify one lesson has content
        const lesson = await client.query('SELECT title, content FROM learn_lessons LIMIT 1');
        if (lesson.rows.length > 0) {
            console.log(`✅ Verified Lesson "${lesson.rows[0].title}" has content (${lesson.rows[0].content ? 'Present' : 'Missing'})`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

main();
