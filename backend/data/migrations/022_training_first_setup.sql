-- Setup completion must not require sharing measurements or setting food targets.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS training_preferences JSONB;
