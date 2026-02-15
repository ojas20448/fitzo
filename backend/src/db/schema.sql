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
  muscle_group muscle_group,
  visibility intent_visibility DEFAULT 'friends',
  note VARCHAR(200),
  session_label VARCHAR(100) DEFAULT NULL,
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
  content TEXT,  -- Markdown content for lesson reading mode
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
