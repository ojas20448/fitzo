-- Store the muscle group on exercise_logs directly.
-- The mobile Smart Log already knows each exercise's target muscle, but the
-- structured mirror could only attribute muscle via a name-match against the
-- 38-row exercises table ("Barbell Bench Press" != "Bench Press" → 'other').
-- With this column, volume/heatmap/PR queries fall back to the muscle the
-- client reported when no catalog match exists.

ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS muscle_group VARCHAR(50);

COMMENT ON COLUMN exercise_logs.muscle_group IS 'Normalized muscle bucket (chest/back/shoulders/arms/legs/core) reported by the client; fallback when exercise_id is null';
