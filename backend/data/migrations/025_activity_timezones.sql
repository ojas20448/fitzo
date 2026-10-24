ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS logged_timezone TEXT;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checked_timezone TEXT;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS completed_timezone TEXT;
ALTER TABLE body_measurements ADD COLUMN IF NOT EXISTS recorded_timezone TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Keep stored historical days: the original location of legacy activity is unknown.
CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE
    v_streak INTEGER := 0;
    v_date DATE;
    v_trained BOOLEAN;
BEGIN
    SELECT (NOW() AT TIME ZONE timezone)::date INTO v_date FROM users WHERE id = p_user_id;
    IF v_date IS NULL THEN RETURN 0; END IF;

    SELECT EXISTS (
        SELECT 1 FROM attendances WHERE user_id = p_user_id AND (checked_in_at AT TIME ZONE COALESCE(checked_timezone, 'Asia/Kolkata'))::date = v_date
        UNION ALL
        SELECT 1 FROM workout_sessions WHERE user_id = p_user_id AND completed_at IS NOT NULL
            AND (completed_at AT TIME ZONE COALESCE(completed_timezone, 'Asia/Kolkata'))::date = v_date
    ) INTO v_trained;
    IF NOT v_trained THEN v_date := v_date - 1; END IF;

    LOOP
        SELECT EXISTS (
            SELECT 1 FROM attendances WHERE user_id = p_user_id AND (checked_in_at AT TIME ZONE COALESCE(checked_timezone, 'Asia/Kolkata'))::date = v_date
            UNION ALL
            SELECT 1 FROM workout_sessions WHERE user_id = p_user_id AND completed_at IS NOT NULL
                AND (completed_at AT TIME ZONE COALESCE(completed_timezone, 'Asia/Kolkata'))::date = v_date
        ) INTO v_trained;
        EXIT WHEN NOT v_trained;
        v_streak := v_streak + 1;
        v_date := v_date - 1;
    END LOOP;
    RETURN v_streak;
END;
$function$;
