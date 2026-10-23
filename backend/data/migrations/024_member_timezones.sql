ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
-- NULL means the meal predates per-entry timezone tracking.
ALTER TABLE calorie_logs ADD COLUMN IF NOT EXISTS logged_timezone TEXT;
