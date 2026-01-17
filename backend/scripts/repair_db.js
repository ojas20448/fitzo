const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function repair() {
    console.log('Starting DB Repair...');

    try {
        // 1. Fix calorie_logs table
        console.log('Checking calorie_logs...');
        await pool.query(`
            ALTER TABLE calorie_logs 
            ADD COLUMN IF NOT EXISTS logged_date DATE NOT NULL DEFAULT CURRENT_DATE;
        `);
        console.log('Fixed: calorie_logs.logged_date');

        // 2. Fix get_user_streak function
        console.log('Recreating get_user_streak function...');
        await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
            RETURNS INTEGER AS $$
            DECLARE
              streak INTEGER := 0;
              check_date DATE := CURRENT_DATE;
              attendance_exists BOOLEAN;
            BEGIN
              LOOP
                SELECT EXISTS(
                  SELECT 1 FROM attendances 
                  WHERE user_id = p_user_id 
                  AND attendances.check_date = get_user_streak.check_date
                ) INTO attendance_exists;
                
                EXIT WHEN NOT attendance_exists;
                
                streak := streak + 1;
                check_date := check_date - 1;
              END LOOP;
              
              RETURN streak;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('Fixed: get_user_streak function');

        // 3. Ensure nutrition_profiles exists (just in case)
        console.log('Checking nutrition_profiles...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nutrition_profiles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                weight_kg DECIMAL(5,2),
                height_cm DECIMAL(5,2),
                age INTEGER,
                gender VARCHAR(10),
                activity_level VARCHAR(20) DEFAULT 'moderate',
                goal_type VARCHAR(20) DEFAULT 'maintenance',
                target_weight_kg DECIMAL(5,2),
                weekly_goal_kg DECIMAL(3,2),
                target_calories INTEGER,
                target_protein INTEGER,
                target_carbs INTEGER,
                target_fat INTEGER,
                is_vegetarian BOOLEAN DEFAULT false,
                protein_priority BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('Fixed: nutrition_profiles table');

    } catch (err) {
        console.error('Repair failed:', err);
    } finally {
        await pool.end();
        console.log('Done.');
    }
}

repair();
