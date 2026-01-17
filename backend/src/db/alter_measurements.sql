-- Ensure table exists first
CREATE TABLE IF NOT EXISTS body_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight DECIMAL(5,2),
    body_fat DECIMAL(4,2),
    chest DECIMAL(5,2),
    waist DECIMAL(5,2),
    hips DECIMAL(5,2),
    arms DECIMAL(5,2),
    thighs DECIMAL(5,2),
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add detailed measurement columns
ALTER TABLE body_measurements
ADD COLUMN IF NOT EXISTS neck DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS shoulders DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS left_arm DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS right_arm DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS left_thigh DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS right_thigh DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS left_calf DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS right_calf DECIMAL(5,2);

SELECT 'Body measurements schema updated successfully!' as status;
