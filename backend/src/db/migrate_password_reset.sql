-- Migration: Create password_reset_tokens table
-- Previously created inline in routes/auth.js at module load time.
-- Moved here for proper migration management.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens (email, used, expires_at);
