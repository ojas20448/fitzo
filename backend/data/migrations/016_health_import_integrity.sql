BEGIN;
CREATE TABLE IF NOT EXISTS health_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER,
    active_calories INTEGER,
    resting_heart_rate SMALLINT,
    sleep_hours NUMERIC(3,1),
    source TEXT DEFAULT 'wearable',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
ALTER TABLE health_data DROP CONSTRAINT IF EXISTS health_data_user_id_fkey;
ALTER TABLE health_data ADD CONSTRAINT health_data_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE health_data ALTER COLUMN steps DROP DEFAULT;
ALTER TABLE health_data ALTER COLUMN active_calories DROP DEFAULT;
COMMIT;
