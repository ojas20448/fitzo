-- Private per-user food island.
--
-- WHY a separate table: AI macro estimates are guesses. Writing them into the
-- shared Indian-food catalog would corrupt a curated dataset for every user.
-- These rows are scoped to one user and never surface in catalog search.

CREATE TABLE IF NOT EXISTS user_foods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    calories INTEGER NOT NULL,
    protein NUMERIC(5, 1) NOT NULL,
    carbs NUMERIC(5, 1) NOT NULL,
    fat NUMERIC(5, 1) NOT NULL,
    serving_size VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Older deployments may have the table without serving_size
ALTER TABLE user_foods ADD COLUMN IF NOT EXISTS serving_size VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_foods_user_id ON user_foods(user_id);

-- One row per (user, food name). Without this, logging "2 roti" daily inserts
-- 365 near-identical rows; with it, re-logging refreshes the estimate instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_foods_user_name
    ON user_foods (user_id, lower(name));
