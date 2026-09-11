BEGIN;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS source_workout_log_id UUID
    REFERENCES workout_logs(id) ON DELETE CASCADE;
-- Link historical mirrors only when the relationship is unambiguous. Do not
-- guess across multiple workouts or discard historical exercise data.
WITH candidates AS (
    SELECT ws.id AS session_id, wl.id AS log_id,
           COUNT(*) OVER (PARTITION BY ws.id) AS matches
    FROM workout_sessions ws JOIN workout_logs wl
      ON wl.user_id = ws.user_id AND wl.logged_date = (ws.started_at AT TIME ZONE 'UTC')::date
    WHERE ws.notes = 'smart-log' AND ws.source_workout_log_id IS NULL
      AND (ws.day_name = wl.workout_type::text OR
           (SELECT COUNT(*) FROM workout_logs other WHERE other.user_id = wl.user_id AND other.logged_date = wl.logged_date) = 1)
)
UPDATE workout_sessions ws SET source_workout_log_id = c.log_id
FROM candidates c WHERE ws.id = c.session_id AND c.matches = 1;
CREATE INDEX IF NOT EXISTS idx_workout_sessions_source ON workout_sessions(source_workout_log_id);
COMMIT;
