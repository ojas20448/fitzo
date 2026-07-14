-- Migration: Add Leaderboard and Kudos Tables
-- Date: 2026-07-14
-- Purpose: Track weekly XP gains and kudos (social fist-bumps) between members

BEGIN;

-- XP Logs table to audit XP transactions and calculate weekly leaderboards
CREATE TABLE IF NOT EXISTS xp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    activity_type VARCHAR(50) NOT NULL, -- 'workout', 'nutrition', 'lesson', 'checkin'
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for retrieving current week's user XP totals
CREATE INDEX IF NOT EXISTS idx_xp_logs_user_date ON xp_logs(user_id, created_at DESC);

-- Kudos table for social fist-bumps
CREATE TABLE IF NOT EXISTS kudos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Limit to one kudo per sender/receiver pair per week
    UNIQUE (sender_id, receiver_id, week_start_date),
    -- Prevent self-kudoing
    CONSTRAINT chk_kudos_no_self CHECK (sender_id <> receiver_id)
);

-- Index for checking kudos counts on leaderboard
CREATE INDEX IF NOT EXISTS idx_kudos_receiver_week ON kudos(receiver_id, week_start_date);

COMMIT;
