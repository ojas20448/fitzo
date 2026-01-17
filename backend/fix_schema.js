require('dotenv').config();
const { Client } = require('pg');

async function fixSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // Create calorie_logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS calorie_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                food_name VARCHAR(255) NOT NULL,
                calories INTEGER NOT NULL,
                protein INTEGER DEFAULT 0,
                carbs INTEGER DEFAULT 0,
                fat INTEGER DEFAULT 0,
                logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created/Verified calorie_logs table');

        // Create workout_logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS workout_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                workout_template_id UUID,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP WITH TIME ZONE,
                duration_seconds INTEGER,
                calories_burned INTEGER,
                notes TEXT
            );
        `);
        console.log('✅ Created/Verified workout_logs table');

        // Create get_user_streak function (mock implementation)
        await client.query(`
            CREATE OR REPLACE FUNCTION get_user_streak(uid UUID)
            RETURNS TABLE (current_streak INTEGER, best_streak INTEGER) AS $$
            BEGIN
                RETURN QUERY SELECT 0, 0; -- Mock return for now
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Created/Verified get_user_streak function');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

fixSchema();
