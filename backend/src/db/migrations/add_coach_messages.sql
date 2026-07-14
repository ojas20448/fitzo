-- Migration: Add coach messages table and AI profile summary column
-- Date: 2026-07-14
-- Purpose: Persist chat turns for the AI Coach and store monthly summarized profiles

BEGIN;

-- Create coach messages table
CREATE TABLE IF NOT EXISTS coach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for retrieving chronological chat history per user
CREATE INDEX IF NOT EXISTS idx_coach_messages_user ON coach_messages(user_id, created_at ASC);

-- Add AI profile summary to fitness profiles
ALTER TABLE fitness_profiles 
    ADD COLUMN IF NOT EXISTS ai_profile_summary TEXT DEFAULT NULL;

COMMIT;
