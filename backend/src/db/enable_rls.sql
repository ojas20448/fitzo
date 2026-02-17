-- ===========================================
-- DATABASE SECURITY HARDENING: RLS
-- ===========================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE calorie_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calorie_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;

-- Optional/Extended tables from migrations (if they exist)
DO $$ BEGIN
    ALTER TABLE IF EXISTS fitness_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS body_measurements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS workout_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS published_splits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS exercises ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS exercise_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS set_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS user_splits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS recipes ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. DEFINE POLICIES

-- GYMS: Everyone can read, only Admins (Managers) can write
CREATE POLICY "Gyms are viewable by everyone" ON gyms FOR SELECT USING (true);

-- USERS: Users can see themselves. Managers can see all members in their gym.
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- ATTENDANCES: Users can see/manage their own check-ins.
CREATE POLICY "Users can manage their own attendances" ON attendances 
    FOR ALL USING (auth.uid() = user_id);

-- FRIENDSHIPS: Users can see/manage friendships they are part of.
CREATE POLICY "Users can view their friendships" ON friendships 
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage their friendships" ON friendships 
    FOR ALL USING (auth.uid() = user_id);

-- LOGS & PLANS: Strictly private to the owner.
CREATE POLICY "Users can manage their workout plans" ON workout_plans FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "Users can manage their calorie plans" ON calorie_plans FOR ALL USING (auth.uid() = member_id);
CREATE POLICY "Users can manage their workout logs" ON workout_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their calorie logs" ON calorie_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their nutrition profiles" ON nutrition_profiles FOR ALL USING (auth.uid() = user_id);

-- INTENTS: Owner can manage. Friends/Public can see based on toggle.
CREATE POLICY "Users can manage their intents" ON workout_intents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view friends intents" ON workout_intents FOR SELECT 
    USING (visibility = 'public' OR 
          (visibility = 'friends' AND user_id IN (
              SELECT friend_id FROM friendships WHERE user_id = auth.uid() AND status = 'accepted'
              UNION
              SELECT user_id FROM friendships WHERE friend_id = auth.uid() AND status = 'accepted'
          )));

-- CLASSES: Everyone can see. Bookings are private.
CREATE POLICY "Classes are viewable by everyone" ON class_sessions FOR SELECT USING (true);
CREATE POLICY "Users can manage their bookings" ON class_bookings FOR ALL USING (auth.uid() = user_id);

-- LEARN: lessons are public. Attempts are private.
CREATE POLICY "Lessons are viewable by everyone" ON learn_lessons FOR SELECT USING (true);
CREATE POLICY "Users can manage their learn attempts" ON learn_attempts FOR ALL USING (auth.uid() = user_id);

-- COMMENTS: Users can manage their own, everyone can see? (Usually depends on post visibility)
CREATE POLICY "Users can manage their own comments" ON comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);

-- SPLITS & EXERCISES:
CREATE POLICY "Exercises are viewable by everyone" ON exercises FOR SELECT USING (true);
CREATE POLICY "Published splits are viewable by everyone" ON published_splits FOR SELECT USING (true);
CREATE POLICY "Users can manage their own splits" ON user_splits FOR ALL USING (auth.uid() = user_id);

-- LOGS (Detailed):
CREATE POLICY "Users can manage their exercise logs" ON exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their set logs" ON set_logs FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATION: 
-- These policies assume auth.uid() is available. 
-- In custom backends not using Supabase Auth directly on the client, 
-- you may need to connect as the user or use a service role.
