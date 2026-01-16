-- Fitzo Database Schema
-- Minimal domain model for Gym SaaS MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if exist (for clean setup)
DROP TABLE IF EXISTS learn_attempts CASCADE;
DROP TABLE IF EXISTS learn_lessons CASCADE;
DROP TABLE IF EXISTS class_bookings CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS workout_intents CASCADE;
DROP TABLE IF EXISTS calorie_plans CASCADE;
DROP TABLE IF EXISTS workout_plans CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS gyms CASCADE;

-- Create ENUMs
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS friendship_status CASCADE;
DROP TYPE IF EXISTS muscle_group CASCADE;
DROP TYPE IF EXISTS intent_visibility CASCADE;

CREATE TYPE user_role AS ENUM ('member', 'trainer', 'manager');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE muscle_group AS ENUM ('legs', 'chest', 'back', 'shoulders', 'arms', 'cardio', 'rest');
CREATE TYPE intent_visibility AS ENUM ('public', 'friends', 'private');

-- ===========================================
-- GYMS TABLE
-- ===========================================
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  qr_code VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  avatar_url VARCHAR(500),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  xp_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_gym ON users(gym_id);
CREATE INDEX idx_users_trainer ON users(trainer_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ===========================================
-- ATTENDANCES TABLE (QR Check-in)
-- ===========================================
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One check-in per day per user
  UNIQUE (user_id, check_date)
);

-- Performance indexes for attendance queries
CREATE INDEX idx_attendance_user_date ON attendances(user_id, checked_in_at DESC);
CREATE INDEX idx_attendance_gym_recent ON attendances(gym_id, checked_in_at DESC);


-- ===========================================
-- FRIENDSHIPS TABLE (Gym Buddies)
-- ===========================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendship_user ON friendships(user_id, status);
CREATE INDEX idx_friendship_friend ON friendships(friend_id, status);

-- ===========================================
-- WORKOUT PLANS TABLE
-- ===========================================
CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workout_plan_member ON workout_plans(member_id);

-- ===========================================
-- CALORIE PLANS TABLE
-- ===========================================
CREATE TABLE calorie_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_calorie_plan_member ON calorie_plans(member_id);

-- ===========================================
-- WORKOUT INTENTS TABLE (Today's Focus)
-- ===========================================
CREATE TABLE workout_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muscle_group muscle_group NOT NULL,
  visibility intent_visibility DEFAULT 'friends',
  note VARCHAR(200),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for intent queries
CREATE INDEX idx_intent_user_expires ON workout_intents(user_id, expires_at DESC);
CREATE INDEX idx_intent_visibility_expires ON workout_intents(visibility, expires_at);

-- ===========================================
-- CLASS SESSIONS TABLE
-- ===========================================
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_mins INTEGER DEFAULT 60,
  max_capacity INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_class_session_gym ON class_sessions(gym_id, scheduled_at);
CREATE INDEX idx_class_session_trainer ON class_sessions(trainer_id);

-- ===========================================
-- CLASS BOOKINGS TABLE
-- ===========================================
CREATE TABLE class_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_booking_session ON class_bookings(session_id);
CREATE INDEX idx_booking_user ON class_bookings(user_id);

-- ===========================================
-- LEARN LESSONS TABLE (Duolingo-style)
-- ===========================================
CREATE TABLE learn_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  unit INTEGER NOT NULL,
  unit_title VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  xp_reward INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lesson_unit ON learn_lessons(unit, order_index);

-- ===========================================
-- LEARN ATTEMPTS TABLE
-- ===========================================
CREATE TABLE learn_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  completed BOOLEAN DEFAULT FALSE,
  xp_earned INTEGER DEFAULT 0,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attempt_user ON learn_attempts(user_id, attempted_at DESC);
CREATE INDEX idx_attempt_lesson ON learn_attempts(lesson_id);

-- ===========================================
-- WORKOUT LOGS TABLE (Member workout tracking)
-- ===========================================
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_type muscle_group NOT NULL,
  exercises TEXT, -- Optional comma-separated exercises
  notes TEXT,
  completed BOOLEAN DEFAULT true,
  visibility intent_visibility DEFAULT 'friends',
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workout_log_user ON workout_logs(user_id, logged_date DESC);
CREATE INDEX idx_workout_log_visibility ON workout_logs(visibility, logged_date DESC);

-- ===========================================
-- CALORIE LOGS TABLE (Member calorie tracking)
-- ===========================================
CREATE TABLE calorie_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories INTEGER NOT NULL CHECK (calories >= 0),
  protein INTEGER DEFAULT 0, -- grams
  carbs INTEGER DEFAULT 0,   -- grams
  fat INTEGER DEFAULT 0,     -- grams
  meal_name VARCHAR(100),
  visibility intent_visibility DEFAULT 'friends',
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_calorie_log_user ON calorie_logs(user_id, logged_date DESC);
CREATE INDEX idx_calorie_log_visibility ON calorie_logs(visibility, logged_date DESC);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to get streak count for a user
CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak INTEGER := 0;
  check_date DATE := CURRENT_DATE;
  attendance_exists BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM attendances 
      WHERE user_id = p_user_id 
      AND attendances.check_date = get_user_streak.check_date
    ) INTO attendance_exists;
    
    EXIT WHEN NOT attendance_exists;
    
    streak := streak + 1;
    check_date := check_date - 1;
  END LOOP;
  
  RETURN streak;
END;
$$ LANGUAGE plpgsql;


-- Function to get crowd level
CREATE OR REPLACE FUNCTION get_crowd_level(p_gym_id UUID)
RETURNS TABLE(level VARCHAR, count INTEGER) AS $$
DECLARE
  checkin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO checkin_count
  FROM attendances
  WHERE gym_id = p_gym_id
  AND checked_in_at > NOW() - INTERVAL '60 minutes';
  
  IF checkin_count < 20 THEN
    RETURN QUERY SELECT 'low'::VARCHAR, checkin_count;
  ELSIF checkin_count < 40 THEN
    RETURN QUERY SELECT 'medium'::VARCHAR, checkin_count;
  ELSE
    RETURN QUERY SELECT 'high'::VARCHAR, checkin_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE gyms IS 'Physical gym locations with unique QR codes';
COMMENT ON TABLE users IS 'All app users: members, trainers, managers';
COMMENT ON TABLE attendances IS 'QR check-in records, one per day per user';
COMMENT ON TABLE friendships IS 'Mutual gym buddies connections';
COMMENT ON TABLE workout_intents IS 'Today''s workout focus, auto-expires at end of day';
COMMENT ON TABLE class_sessions IS 'Scheduled group fitness classes';
COMMENT ON TABLE learn_lessons IS 'MCQ-based fitness education lessons';
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
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  instructions TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_calories INTEGER DEFAULT 0,
  total_protein INTEGER DEFAULT 0,
  total_carbs INTEGER DEFAULT 0,
  total_fat INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recipes_user_id ON recipes(user_id);
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
CREATE OR REPLACE FUNCTION calculate_daily_calories(
    p_weight_kg DECIMAL,
    p_height_cm DECIMAL,
    p_age INTEGER,
    p_gender VARCHAR,
    p_activity activity_level,
    p_goal nutrition_goal
) RETURNS INTEGER AS $$
DECLARE
    bmr DECIMAL;
    tdee DECIMAL;
    activity_multiplier DECIMAL;
    goal_adjustment INTEGER;
BEGIN
    -- Harris-Benedict BMR calculation
    IF p_gender = 'male' THEN
        bmr := 88.362 + (13.397 * p_weight_kg) + (4.799 * p_height_cm) - (5.677 * p_age);
    ELSE
        bmr := 447.593 + (9.247 * p_weight_kg) + (3.098 * p_height_cm) - (4.330 * p_age);
    END IF;
    
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
    
    -- Goal adjustment
    goal_adjustment := CASE p_goal
        WHEN 'fat_loss' THEN -400
        WHEN 'muscle_gain' THEN 300
        ELSE 0
    END;
    
    RETURN ROUND(tdee + goal_adjustment);
END;
$$ LANGUAGE plpgsql;

SELECT 'Nutrition profile migration complete!' as status;
-- Enhanced Today's Focus Migration
-- Adds split_type and session_type for training splits

-- Add new ENUMs
DO $$ BEGIN
    CREATE TYPE split_type AS ENUM ('full_body', 'upper_lower', 'ppl', 'bro_split', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_type AS ENUM (
        'full_body', 'upper', 'lower', 'push', 'pull', 'legs',
        'chest', 'back', 'shoulders', 'arms', 'cardio', 'rest'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to workout_intents (keeping muscle_group for backward compatibility)
ALTER TABLE workout_intents 
ADD COLUMN IF NOT EXISTS split_type split_type DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS session_type session_type;

-- Migrate existing muscle_group data to session_type
UPDATE workout_intents 
SET session_type = muscle_group::text::session_type
WHERE session_type IS NULL AND muscle_group IS NOT NULL;

-- Add index for split_type queries
CREATE INDEX IF NOT EXISTS idx_intent_split ON workout_intents(split_type);

SELECT 'Migration complete!' as status;
-- Upgrade Today's Focus - Composable Intent System
-- Adds emphasis array and session_label for advanced splits

-- Add emphasis column as TEXT array
ALTER TABLE workout_intents 
ADD COLUMN IF NOT EXISTS emphasis TEXT[] DEFAULT '{}';

-- Add session_label column (A or B)
ALTER TABLE workout_intents 
ADD COLUMN IF NOT EXISTS session_label VARCHAR(1) DEFAULT NULL;

-- Migrate existing session_type data to emphasis array
UPDATE workout_intents 
SET emphasis = ARRAY[session_type::text]
WHERE emphasis = '{}' AND session_type IS NOT NULL;

-- Rename training_pattern if split_type exists
-- (split_type becomes training_pattern conceptually, but we keep column name)

SELECT 'Migration complete!' as status;
-- Published Splits Library
-- Supports official Fitzo splits and community-published splits

CREATE TABLE IF NOT EXISTS published_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    days_per_week INTEGER,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    program_structure JSONB, -- { "Day 1": ["Chest", "Triceps"], "Day 2": ["Back", "Biceps"] }
    tags TEXT[],
    author_name VARCHAR(100) DEFAULT 'Fitzo Team',
    is_official BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching/filtering
CREATE INDEX IF NOT EXISTS idx_published_splits_tags ON published_splits USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_published_splits_official ON published_splits(is_official);

-- Seed Initial Official Splits
INSERT INTO published_splits (name, description, days_per_week, difficulty_level, program_structure, tags, is_official, author_name)
VALUES 
(
    'PPL (6 Day) - High Volume',
    'Classic Push Pull Legs split run twice a week. Optimal for hypertrophy and intermediate-to-advanced lifters who can recover from 6 days of training.',
    6,
    'intermediate',
    '{
        "Day 1": "Push A (Chest Focus)",
        "Day 2": "Pull A (Back Width)",
        "Day 3": "Legs A (Quad Focus)",
        "Day 4": "Push B (Shoulder Focus)",
        "Day 5": "Pull B (Back Thickness)",
        "Day 6": "Legs B (Glute/Ham Focus)"
    }',
    ARRAY['hypertrophy', 'aesthetics', 'high volume'],
    true,
    'Fitzo Team'
),
(
    'PPL (3 Day) - Essentials',
    'A lower frequency variation of the classic PPL. Great for busy schedules while still hitting every muscle group hard.',
    3,
    'beginner',
    '{
        "Day 1": "Push",
        "Day 2": "Pull",
        "Day 3": "Legs"
    }',
    ARRAY['beginner', 'time efficient', 'essentials'],
    true,
    'Fitzo Team'
),
(
    'Upper Lower (4 Day)',
    'Balanced split hitting upper and lower body twice a week. Best balance of frequency and recovery.',
    4,
    'intermediate',
    '{
        "Day 1": "Upper Power",
        "Day 2": "Lower Power",
        "Day 3": "Rest",
        "Day 4": "Upper Hypertrophy",
        "Day 5": "Lower Hypertrophy",
        "Day 6": "Rest",
        "Day 7": "Rest"
    }',
    ARRAY['strength', 'hypertrophy', 'balanced'],
    true,
    'Fitzo Team'
),
(
    'Bro Split (5 Day)',
    'Old school body part split. One muscle group per day using high volume to obliterate the target muscle.',
    5,
    'intermediate',
    '{
        "Day 1": "Chest",
        "Day 2": "Back",
        "Day 3": "Legs",
        "Day 4": "Shoulders",
        "Day 5": "Arms"
    }',
    ARRAY['bodybuilding', 'focus', 'volume'],
    true,
    'Fitzo Team'
),
(
    'Full Body (3 Day)',
    'Hit every muscle group 3x a week. Best for beginners to master form and build a solid foundation.',
    3,
    'beginner',
    '{
        "Day 1": "Full Body A",
        "Day 2": "Rest",
        "Day 3": "Full Body B",
        "Day 4": "Rest",
        "Day 5": "Full Body C",
        "Day 6": "Rest",
        "Day 7": "Rest"
    }',
    ARRAY['beginner', 'strength', 'foundation'],
    true,
    'Fitzo Team'
);

SELECT 'Published splits schema created and seeded!' as status;
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
