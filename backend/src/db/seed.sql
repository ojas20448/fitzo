-- Fitzo Seed Data
-- Sample data for development and testing

-- ===========================================
-- GYMS
-- ===========================================
INSERT INTO gyms (id, name, qr_code) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Iron Paradise', 'IRONPARADISE01'),
  ('22222222-2222-2222-2222-222222222222', 'FitZone Studio', 'FITZONE01');

-- ===========================================
-- USERS (password: test123)
-- Hash generated with bcrypt for: test123
-- ===========================================
INSERT INTO users (id, email, password_hash, name, role, gym_id, xp_points) VALUES
  -- Manager
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'manager@fitzo.app', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Sanjay Kumar', 'manager', '11111111-1111-1111-1111-111111111111', 0),
  
  -- Trainers
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'trainer1@fitzo.app', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Rahul Kapoor', 'trainer', '11111111-1111-1111-1111-111111111111', 200),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'trainer2@fitzo.app', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Priya Sharma', 'trainer', '11111111-1111-1111-1111-111111111111', 150);

-- Members (assigned to trainers)
INSERT INTO users (id, email, password_hash, name, role, gym_id, trainer_id, xp_points) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'rahul@example.com', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Rahul Kumar', 'member', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 450),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'priya@example.com', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Priya Singh', 'member', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 320),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'amit@example.com', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Amit Patel', 'member', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 180),
  ('00000000-0000-0000-0000-000000000001', 'sneha@example.com', '$2a$10$8KVq8OdKL5y8PPdPFpDiC.tKgqKxHdNrqIxPwV0QfZQ0yHUX0F.Aa', 'Sneha Kapoor', 'member', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 520);

-- ===========================================
-- FRIENDSHIPS (Gym Buddies)
-- ===========================================
INSERT INTO friendships (user_id, friend_id, status) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'accepted'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'accepted'),
  ('00000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'pending');

-- ===========================================
-- ATTENDANCES (Past 5 days for streak demo)
-- ===========================================
INSERT INTO attendances (user_id, gym_id, check_date, checked_in_at) VALUES
  -- Rahul's streak (5 days)
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, NOW() - INTERVAL '1 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 2, NOW() - INTERVAL '2 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 3, NOW() - INTERVAL '3 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 4, NOW() - INTERVAL '4 days'),
  -- Priya's check-in today
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, NOW() - INTERVAL '20 minutes'),
  -- Sneha's check-in today
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, NOW() - INTERVAL '1 hour');


-- ===========================================
-- WORKOUT INTENTS (Today's Focus)
-- ===========================================
INSERT INTO workout_intents (user_id, muscle_group, visibility, note, expires_at) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'legs', 'friends', 'Squat PR attempt! 🔥', (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMP),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cardio', 'public', 'Easy cardio day', (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMP),
  ('00000000-0000-0000-0000-000000000001', 'back', 'friends', 'Deadlift focus', (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMP);

-- ===========================================
-- CLASS SESSIONS
-- ===========================================
INSERT INTO class_sessions (gym_id, trainer_id, name, scheduled_at, duration_mins, max_capacity) VALUES
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Power Yoga', NOW() + INTERVAL '2 hours', 60, 20),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'HIIT Blast', NOW() + INTERVAL '4 hours', 45, 15),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Zumba Dance', NOW() + INTERVAL '6 hours', 60, 25),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Strength & Core', NOW() + INTERVAL '8 hours', 45, 12);

-- ===========================================
-- LEARN LESSONS
-- ===========================================
INSERT INTO learn_lessons (id, title, unit, unit_title, order_index, description, xp_reward, questions) VALUES
  -- Unit 1: Getting Started
  ('a1111111-1111-1111-1111-111111111111', 'Gym Etiquette', 1, 'Getting Started', 1, 'Learn basic gym manners', 10, 
   '[
     {"question": "Should you wipe down equipment after use?", "options": ["No, the staff does it", "Only if sweaty", "Always", "Only cardio machines"], "correct": 2},
     {"question": "What should you do with weights after use?", "options": ["Leave them out", "Put them back", "Stack anywhere", "Ask someone else"], "correct": 1}
   ]'::jsonb),
  
  ('a2222222-2222-2222-2222-222222222222', 'Equipment Tour', 1, 'Getting Started', 2, 'Know your gym equipment', 15,
   '[
     {"question": "What is a cable machine used for?", "options": ["Cardio only", "Stretching", "Strength training", "Resting"], "correct": 2},
     {"question": "Which machine is best for legs?", "options": ["Treadmill", "Leg press", "Pull-up bar", "Bench"], "correct": 1}
   ]'::jsonb),
  
  ('a3333333-3333-3333-3333-333333333333', 'Proper Form: Squat', 1, 'Getting Started', 3, 'Master the squat', 20,
   '[
     {"question": "Where should your knees point during a squat?", "options": ["Inward", "Over your toes", "Outward parallel to feet", "Anywhere"], "correct": 2},
     {"question": "How deep should you squat?", "options": ["Quarter depth", "Until thighs parallel", "Just a bit", "As deep as comfortable with good form"], "correct": 3}
   ]'::jsonb),

  -- Unit 2: Fueling Your Body
  ('b1111111-1111-1111-1111-111111111111', 'Hydration Basics', 2, 'Fueling Your Body', 1, 'Stay hydrated', 10,
   '[
     {"question": "How much water should you drink during workout?", "options": ["None", "Sips every 15-20 min", "1 gallon at once", "Only after workout"], "correct": 1}
   ]'::jsonb),
  
  ('b2222222-2222-2222-2222-222222222222', 'Protein 101', 2, 'Fueling Your Body', 2, 'Understanding protein', 15,
   '[
     {"question": "When is the best time to consume protein?", "options": ["Only morning", "Within 2 hours of workout", "Never", "Only at night"], "correct": 1}
   ]'::jsonb);

-- ===========================================
-- WORKOUT PLANS (Sample)
-- ===========================================
INSERT INTO workout_plans (member_id, trainer_id, plan_data) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   '{"name": "Strength Building", "days": {"monday": "Chest & Triceps", "wednesday": "Back & Biceps", "friday": "Legs & Shoulders"}}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '{"name": "Fat Loss", "days": {"monday": "Full Body", "wednesday": "HIIT", "friday": "Cardio + Core"}}'::jsonb);

-- ===========================================
-- CALORIE PLANS (Sample)
-- ===========================================
INSERT INTO calorie_plans (member_id, trainer_id, plan_data) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '{"daily_calories": 2500, "protein_g": 150, "carbs_g": 250, "fat_g": 80}'::jsonb);

-- Done!
SELECT 'Seed data inserted successfully!' as status;
