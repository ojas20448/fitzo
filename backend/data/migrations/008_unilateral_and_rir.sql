-- Unilateral exercises are entered per side, so their volume counts both.
-- Lives on exercise_logs, not set_logs: the flag describes the exercise as
-- performed, and per-set would allow set 1 unilateral, set 2 not.
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN NOT NULL DEFAULT false;

-- RIR as the member entered it. The existing rpe column keeps its derived
-- value (rpe = 10 - rir) so nothing already reading rpe breaks.
-- NULL here means "not recorded", which is NOT the same as 0 ("to failure").
ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS rir INTEGER;

-- Per-member preferences, following the users.share_logs_default pattern.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS log_rir_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workout_prefs_seen BOOLEAN NOT NULL DEFAULT false;
