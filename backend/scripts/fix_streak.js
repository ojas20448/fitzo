
require('dotenv').config();
const { query } = require('../src/config/database');

async function fixFunction() {
    console.log('Fixing get_user_streak function...');

    try {
        await query(`
            CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
            RETURNS INTEGER AS $$
            DECLARE
              v_streak INTEGER := 0;
              v_check_date DATE := CURRENT_DATE;
              v_attendance_exists BOOLEAN;
            BEGIN
              LOOP
                SELECT EXISTS(
                  SELECT 1 FROM attendances 
                  WHERE user_id = p_user_id 
                  AND check_date = v_check_date
                ) INTO v_attendance_exists;
                
                EXIT WHEN NOT v_attendance_exists;
                
                v_streak := v_streak + 1;
                v_check_date := v_check_date - 1;
              END LOOP;
              
              RETURN v_streak;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Function updated successfully!');
    } catch (e) {
        console.error('❌ Error updating function:', e);
    }
    process.exit();
}

fixFunction();
