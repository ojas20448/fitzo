-- Existing tokens implicitly have version zero. Password reset increments it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
