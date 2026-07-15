-- Add push notification metadata + preferences columns that
-- routes/notifications.js expects but were never migrated.
-- (Live DB only had push_token — /status and /preferences returned 500.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_platform VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_device_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_registered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

COMMENT ON COLUMN users.notification_preferences IS 'User notification toggles (workoutReminders, streakAlerts, etc.) — null means all defaults';
