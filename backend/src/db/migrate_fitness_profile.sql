-- Create Fitness Goal Enum
CREATE TYPE fitness_goal AS ENUM ('deficit', 'maintenance', 'surplus');

-- Create Fitness Profiles Table (One per user)
CREATE TABLE IF NOT EXISTS fitness_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal_type fitness_goal DEFAULT 'maintenance',
    current_weight DECIMAL(5,2), -- kg
    target_weight DECIMAL(5,2), -- kg
    height DECIMAL(5,2), -- cm
    age INTEGER,
    gender VARCHAR(10), -- 'male', 'female', 'other'
    activity_level VARCHAR(20) DEFAULT 'sedentary', -- sedentary, light, moderate, active, very_active
    target_calories INTEGER, -- Manual or calculated override
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Body Measurements Table (History)
CREATE TABLE IF NOT EXISTS body_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight DECIMAL(5,2),
    body_fat DECIMAL(4,2), -- percentage
    chest DECIMAL(5,2), -- cm
    waist DECIMAL(5,2), -- cm
    hips DECIMAL(5,2), -- cm
    arms DECIMAL(5,2), -- cm
    thighs DECIMAL(5,2), -- cm
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for retrieving history
CREATE INDEX IF NOT EXISTS idx_measurements_user ON body_measurements(user_id, recorded_at DESC);
