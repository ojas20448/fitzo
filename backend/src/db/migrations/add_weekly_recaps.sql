-- Migration: Add weekly recaps table
-- Date: 2026-07-14
-- Purpose: Store AI-generated weekly fitness summaries and metrics for members

BEGIN;

CREATE TABLE IF NOT EXISTS weekly_recaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recap_data JSONB NOT NULL DEFAULT '{}',
    summary_text TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- One recap per user per week start date
    UNIQUE (user_id, week_start_date)
);

-- Index for retrieving chronological weekly recaps
CREATE INDEX IF NOT EXISTS idx_weekly_recaps_user_date ON weekly_recaps(user_id, week_start_date DESC);

COMMIT;
