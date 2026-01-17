const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../src/config/database');

async function fixSchema() {
    try {
        console.log('Starting schema fix...');

        // 1. Fix workout_intents session_label length
        console.log('Altering workout_intents session_label...');
        await query(`ALTER TABLE workout_intents ALTER COLUMN session_label TYPE VARCHAR(50)`);

        // 2. Add created_at to calorie_logs if missing
        console.log('Adding created_at to calorie_logs...');
        await query(`ALTER TABLE calorie_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 3. Add logged_date to workout_logs if missing
        console.log('Adding logged_date to workout_logs...');
        await query(`ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS logged_date DATE DEFAULT CURRENT_DATE`);

        // 3b. Add created_at to workout_logs if missing
        console.log('Adding created_at to workout_logs...');
        await query(`ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 3c. Add workout_type to workout_logs if missing
        console.log('Adding workout_type to workout_logs...');
        await query(`ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS workout_type VARCHAR(50)`);

        // 3d. Relax constraint on muscle_group in workout_intents (since we use emphasis now)
        console.log('Relaxing muscle_group constraint in workout_intents...');
        // We wrap in try-catch in case column doesn't exist, though error suggests it does
        try {
            await query(`ALTER TABLE workout_intents ALTER COLUMN muscle_group DROP NOT NULL`);
        } catch (e) {
            console.log('Note: muscle_group column might not exist or verify failed, continuing...', e.message);
        }

        // 4. Create get_user_streak function
        console.log('Creating get_user_streak function...');
        await query('DROP FUNCTION IF EXISTS get_user_streak(UUID)');
        await query(`
            CREATE OR REPLACE FUNCTION get_user_streak(uid UUID)
            RETURNS INTEGER AS $$
            DECLARE
                v_streak INTEGER := 0;
                v_check_date DATE := CURRENT_DATE;
                v_has_checkin BOOLEAN;
            BEGIN
                -- Check if checked in today
                SELECT EXISTS(
                    SELECT 1 FROM attendances 
                    WHERE user_id = uid 
                    AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = v_check_date
                ) INTO v_has_checkin;

                IF v_has_checkin THEN
                    v_streak := 1;
                    v_check_date := v_check_date - 1;
                ELSE
                    -- If not checked in today, check yesterday
                    v_check_date := v_check_date - 1;
                END IF;

                LOOP
                    SELECT EXISTS(
                        SELECT 1 FROM attendances 
                        WHERE user_id = uid 
                        AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = v_check_date
                    ) INTO v_has_checkin;

                    EXIT WHEN NOT v_has_checkin;

                    v_streak := v_streak + 1;
                    v_check_date := v_check_date - 1;
                END LOOP;

                RETURN v_streak;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log('Schema fixes applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing schema:', err);
        process.exit(1);
    }
}

fixSchema();
