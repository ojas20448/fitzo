-- Nutrition Profile Migration
-- Stores user's nutrition goals, targets, and body metrics

-- Goal type enum
DO $$ BEGIN
    CREATE TYPE nutrition_goal AS ENUM ('fat_loss', 'maintenance', 'muscle_gain');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Activity level enum
DO $$ BEGIN
    CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Nutrition profiles table
CREATE TABLE IF NOT EXISTS nutrition_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Physical metrics
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    age INTEGER,
    gender VARCHAR(10),
    activity_level activity_level DEFAULT 'moderate',
    
    -- Goals
    goal_type nutrition_goal DEFAULT 'maintenance',
    target_weight_kg DECIMAL(5,2),
    weekly_goal_kg DECIMAL(3,2), -- Weight change per week (e.g., -0.5 for losing 0.5kg/week)
    
    -- Daily targets (can be auto-calculated or manually set)
    target_calories INTEGER,
    target_protein INTEGER,
    target_carbs INTEGER,
    target_fat INTEGER,
    
    -- Preferences
    is_vegetarian BOOLEAN DEFAULT false,
    protein_priority BOOLEAN DEFAULT true, -- Protein-first tracking emphasis
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_nutrition_profile_user ON nutrition_profiles(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_nutrition_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_profile_updated ON nutrition_profiles;
CREATE TRIGGER nutrition_profile_updated
    BEFORE UPDATE ON nutrition_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_nutrition_profile_timestamp();

-- Function to calculate daily calorie target based on profile
-- Uses averaged Mifflin-St Jeor + Revised Harris-Benedict equations
CREATE OR REPLACE FUNCTION calculate_daily_calories(
    p_weight_kg DECIMAL,
    p_height_cm DECIMAL,
    p_age INTEGER,
    p_gender VARCHAR,
    p_activity activity_level,
    p_goal nutrition_goal
) RETURNS INTEGER AS $$
DECLARE
    mifflin_bmr DECIMAL;
    harris_bmr DECIMAL;
    bmr DECIMAL;
    tdee DECIMAL;
    activity_multiplier DECIMAL;
    goal_adjustment INTEGER;
BEGIN
    -- 1. Mifflin-St Jeor Equation
    IF p_gender = 'male' THEN
        mifflin_bmr := 10 * p_weight_kg + 6.25 * p_height_cm - 5 * p_age + 5;
    ELSE
        mifflin_bmr := 10 * p_weight_kg + 6.25 * p_height_cm - 5 * p_age - 161;
    END IF;

    -- 2. Revised Harris-Benedict Equation
    IF p_gender = 'male' THEN
        harris_bmr := 13.397 * p_weight_kg + 4.799 * p_height_cm - 5.677 * p_age + 88.362;
    ELSE
        harris_bmr := 9.247 * p_weight_kg + 3.098 * p_height_cm - 4.330 * p_age + 447.593;
    END IF;

    -- Average both for more accurate BMR
    bmr := (mifflin_bmr + harris_bmr) / 2;
    
    -- Activity multiplier
    activity_multiplier := CASE p_activity
        WHEN 'sedentary' THEN 1.2
        WHEN 'light' THEN 1.375
        WHEN 'moderate' THEN 1.55
        WHEN 'active' THEN 1.725
        WHEN 'very_active' THEN 1.9
        ELSE 1.55
    END;
    
    tdee := bmr * activity_multiplier;
    
    -- Goal adjustment (500 cal deficit = ~1 lb/week loss)
    goal_adjustment := CASE p_goal
        WHEN 'fat_loss' THEN -500
        WHEN 'muscle_gain' THEN 300
        ELSE 0
    END;
    
    RETURN ROUND(tdee + goal_adjustment);
END;
$$ LANGUAGE plpgsql;

SELECT 'Nutrition profile migration complete!' as status;
