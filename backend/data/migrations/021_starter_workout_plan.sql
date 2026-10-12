-- Optional, unperformed workout suggestions attached to a saved split.
-- Existing custom/adopted splits stay unchanged. No workout logs are created.
ALTER TABLE user_splits ADD COLUMN IF NOT EXISTS training_plan JSONB;
