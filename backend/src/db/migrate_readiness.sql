-- Readiness Check-In System
-- Phase 1: Manual check-in for daily readiness scoring

-- Daily readiness logs (morning check-in)
CREATE TABLE IF NOT EXISTS readiness_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Subjective inputs (1-5 scale)
    energy_level INTEGER NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
    sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 5),
    sleep_hours DECIMAL(3,1),      -- e.g. 7.5

    -- Computed readiness score (0-100)
    readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),

    -- Derived recommendation
    recommendation VARCHAR(20) DEFAULT 'normal',
    -- 'deload' | 'light' | 'normal' | 'push' | 'peak'
    recommendation_message TEXT,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One check-in per user per day
    UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_user_date ON readiness_logs(user_id, log_date DESC);
