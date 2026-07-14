-- Migration: Add daily insights table
-- Date: 2026-07-14
-- Purpose: Store daily proactive insights generated for users by AI Coach

BEGIN;

CREATE TABLE IF NOT EXISTS daily_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Max 1 insight per user per day
    UNIQUE (user_id, log_date)
);

-- Index for retrieving the most recent daily insight
CREATE INDEX IF NOT EXISTS idx_daily_insights_user_date ON daily_insights(user_id, log_date DESC);

COMMIT;
