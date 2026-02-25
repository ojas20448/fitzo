-- Migration: Add buddy sharing preferences to users table
-- Date: 2026-02-26
-- Purpose: Add global default for sharing workout and food logs with buddies

BEGIN;

-- Add column to users table
ALTER TABLE users ADD COLUMN
    share_logs_default BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX idx_users_share_logs_default ON users(share_logs_default);

-- Update existing users to have sharing enabled by default
UPDATE users SET share_logs_default = true WHERE share_logs_default IS NULL;

-- Add NOT NULL constraint after setting values
ALTER TABLE users ALTER COLUMN share_logs_default SET NOT NULL;

-- Create audit timestamp column (optional, for tracking when user last changed this setting)
ALTER TABLE users ADD COLUMN
    share_logs_updated_at TIMESTAMP DEFAULT NOW();

COMMIT;
