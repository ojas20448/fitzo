-- Cardio intervals store time and perceived effort; load/reps remain NULL.
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER
    CHECK (duration_seconds > 0 AND duration_seconds <= 86400);
