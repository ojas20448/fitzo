-- Streaks must count training, not turnstile taps.
--
-- get_user_streak() walked `attendances` alone, so a day only counted if the
-- user scanned a gym QR code. Anyone training at home, or at a gym that is not
-- on Fitzo, has gym_id NULL and never checks in — their streak read 0 forever
-- no matter how consistently they trained. The single most motivating number
-- in the app was unreachable for a large share of users.
--
-- Two changes:
--
--   1. A day counts if EITHER a gym check-in OR a completed workout session
--      exists. Check-ins still cover people who train at their gym without
--      logging sets; logged sessions cover everyone with no gym at all.
--
--   2. The walk no longer requires TODAY to be complete. The old loop exited
--      immediately when today had no attendance, so a streak visibly reset to
--      0 at every midnight and only came back after that day's check-in —
--      punishing the user for not having trained yet at 6am. It now starts at
--      today when today qualifies, and otherwise from yesterday, so a streak
--      is only broken by a genuinely missed day.

CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
    v_streak  INTEGER := 0;
    v_date    DATE;
    v_trained BOOLEAN;
BEGIN
    -- Dates are compared in IST to match the rest of the app, which buckets
    -- training days with `AT TIME ZONE 'Asia/Kolkata'`. Comparing in UTC here
    -- would split a late-evening IST session onto the following day and break
    -- the streak of anyone training after 18:30 local.
    v_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

    -- Does today already count?
    SELECT EXISTS (
        SELECT 1 FROM attendances
         WHERE user_id = p_user_id
           AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = v_date
        UNION ALL
        SELECT 1 FROM workout_sessions
         WHERE user_id = p_user_id
           AND completed_at IS NOT NULL
           AND DATE(completed_at AT TIME ZONE 'Asia/Kolkata') = v_date
    ) INTO v_trained;

    -- If not, the streak is still alive if yesterday counted — today simply
    -- has not happened yet.
    IF NOT v_trained THEN
        v_date := v_date - 1;
    END IF;

    LOOP
        SELECT EXISTS (
            SELECT 1 FROM attendances
             WHERE user_id = p_user_id
               AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = v_date
            UNION ALL
            SELECT 1 FROM workout_sessions
             WHERE user_id = p_user_id
               AND completed_at IS NOT NULL
               AND DATE(completed_at AT TIME ZONE 'Asia/Kolkata') = v_date
        ) INTO v_trained;

        EXIT WHEN NOT v_trained;

        v_streak := v_streak + 1;
        v_date := v_date - 1;
    END LOOP;

    RETURN v_streak;
END;
$function$;
