-- Add username column to users table
ALTER TABLE users ADD COLUMN username VARCHAR(30);

-- Populate usernames for existing users 
-- Simple strategy: clean email handle or uuid suffix
UPDATE users SET username = LOWER(TRANSLATE(SUBSTRING(name FROM 1 FOR 5), ' ', '')) || SUBSTRING(id::text FROM 1 FOR 4) WHERE username IS NULL;

-- Enforce uniqueness and not null
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Index for fast search
CREATE INDEX idx_users_username ON users(username);
