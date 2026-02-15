-- Migration: Add push notification columns to users table
-- Run this migration to enable full push notification support

-- Add new columns for push notification support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS push_platform VARCHAR(20),
ADD COLUMN IF NOT EXISTS push_device_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS push_registered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"workoutReminders": true, "streakAlerts": true, "friendActivity": true, "classReminders": true, "achievements": true, "marketing": false}'::jsonb;

-- Create index for push token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.push_token IS 'Expo push token (ExponentPushToken[xxx])';
COMMENT ON COLUMN users.push_platform IS 'Device platform (ios, android, web)';
COMMENT ON COLUMN users.push_device_name IS 'Device name for user reference';
COMMENT ON COLUMN users.push_registered_at IS 'When the push token was registered';
COMMENT ON COLUMN users.notification_preferences IS 'User notification preferences as JSON';
