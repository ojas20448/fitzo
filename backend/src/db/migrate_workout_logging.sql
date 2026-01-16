-- Workout Log Enhancement Migration
-- Allows users to log full workouts with exercises, sets, and reps

-- Create exercises reference table
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- 'chest', 'back', 'legs', etc.
    equipment VARCHAR(50), -- 'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'
    muscle_groups TEXT[], -- Primary muscles worked
    is_compound BOOLEAN DEFAULT false,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workout sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    split_id VARCHAR(50), -- Reference to user's split (e.g., 'ppl_6')
    day_name VARCHAR(50), -- e.g., 'Push', 'Legs', 'Day 1'
    
    -- Session metadata
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Visibility
    visibility VARCHAR(20) DEFAULT 'friends',
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create exercise logs within a session
CREATE TABLE IF NOT EXISTS exercise_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id),
    
    -- For custom exercises not in database
    custom_exercise_name VARCHAR(100),
    
    -- Order in workout
    order_index INTEGER DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create set logs for each exercise
CREATE TABLE IF NOT EXISTS set_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_log_id UUID REFERENCES exercise_logs(id) ON DELETE CASCADE,
    
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_kg DECIMAL(6,2),
    
    -- Set types
    is_warmup BOOLEAN DEFAULT false,
    is_dropset BOOLEAN DEFAULT false,
    is_failure BOOLEAN DEFAULT false,
    
    -- RPE rating (1-10)
    rpe INTEGER,
    
    -- Rest time after this set
    rest_seconds INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's saved splits
CREATE TABLE IF NOT EXISTS user_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    split_id VARCHAR(50) NOT NULL, -- 'ppl_6', 'upper_lower_4', 'custom'
    name VARCHAR(100) NOT NULL,
    days TEXT[], -- Array of day names
    days_per_week INTEGER,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_log_id);
CREATE INDEX IF NOT EXISTS idx_user_splits_user ON user_splits(user_id);

-- Insert common exercises
INSERT INTO exercises (name, category, equipment, muscle_groups, is_compound) VALUES
-- Chest
('Bench Press', 'chest', 'barbell', ARRAY['chest', 'shoulders', 'triceps'], true),
('Incline Bench Press', 'chest', 'barbell', ARRAY['chest', 'shoulders'], true),
('Dumbbell Flyes', 'chest', 'dumbbell', ARRAY['chest'], false),
('Cable Crossover', 'chest', 'cable', ARRAY['chest'], false),
('Push Ups', 'chest', 'bodyweight', ARRAY['chest', 'shoulders', 'triceps'], true),
('Incline Dumbbell Press', 'chest', 'dumbbell', ARRAY['chest', 'shoulders'], true),
('Chest Dips', 'chest', 'bodyweight', ARRAY['chest', 'triceps'], true),

-- Back
('Deadlift', 'back', 'barbell', ARRAY['back', 'hamstrings', 'glutes'], true),
('Barbell Row', 'back', 'barbell', ARRAY['back', 'biceps'], true),
('Lat Pulldown', 'back', 'cable', ARRAY['back', 'biceps'], true),
('Pull Ups', 'back', 'bodyweight', ARRAY['back', 'biceps'], true),
('Seated Cable Row', 'back', 'cable', ARRAY['back', 'biceps'], true),
('T-Bar Row', 'back', 'barbell', ARRAY['back'], true),
('Face Pulls', 'back', 'cable', ARRAY['rear_delts', 'traps'], false),

-- Shoulders
('Overhead Press', 'shoulders', 'barbell', ARRAY['shoulders', 'triceps'], true),
('Lateral Raises', 'shoulders', 'dumbbell', ARRAY['shoulders'], false),
('Front Raises', 'shoulders', 'dumbbell', ARRAY['shoulders'], false),
('Rear Delt Flyes', 'shoulders', 'dumbbell', ARRAY['rear_delts'], false),
('Arnold Press', 'shoulders', 'dumbbell', ARRAY['shoulders'], true),

-- Arms
('Barbell Curl', 'arms', 'barbell', ARRAY['biceps'], false),
('Hammer Curls', 'arms', 'dumbbell', ARRAY['biceps'], false),
('Tricep Pushdown', 'arms', 'cable', ARRAY['triceps'], false),
('Skull Crushers', 'arms', 'barbell', ARRAY['triceps'], false),
('Preacher Curl', 'arms', 'ez_bar', ARRAY['biceps'], false),
('Dips', 'arms', 'bodyweight', ARRAY['triceps', 'chest'], true),

-- Legs
('Squat', 'legs', 'barbell', ARRAY['quads', 'glutes', 'hamstrings'], true),
('Leg Press', 'legs', 'machine', ARRAY['quads', 'glutes'], true),
('Romanian Deadlift', 'legs', 'barbell', ARRAY['hamstrings', 'glutes'], true),
('Leg Curl', 'legs', 'machine', ARRAY['hamstrings'], false),
('Leg Extension', 'legs', 'machine', ARRAY['quads'], false),
('Lunges', 'legs', 'dumbbell', ARRAY['quads', 'glutes'], true),
('Calf Raises', 'legs', 'machine', ARRAY['calves'], false),
('Hip Thrust', 'legs', 'barbell', ARRAY['glutes', 'hamstrings'], true),
('Bulgarian Split Squat', 'legs', 'dumbbell', ARRAY['quads', 'glutes'], true),

-- Core
('Plank', 'core', 'bodyweight', ARRAY['core'], false),
('Hanging Leg Raise', 'core', 'bodyweight', ARRAY['core'], false),
('Cable Crunch', 'core', 'cable', ARRAY['core'], false),
('Ab Wheel Rollout', 'core', 'ab_wheel', ARRAY['core'], false)

ON CONFLICT DO NOTHING;

SELECT 'Workout logging schema created!' as status;
