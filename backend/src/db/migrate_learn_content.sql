-- Migrate Learn Content: Add rich blogs + MCQ
-- This replaces the placeholder data with a real curriculum

-- 1. Clean up old lessons
DELETE FROM learn_lessons;

-- 2. Insert Unit 1: Nutrition Basics
INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, xp_reward, questions) VALUES
(
  'Energy Balance Equation', 1, 'Nutrition Basics', 1,
  '# The Law of Thermodynamics\n\nAt its core, weight management is a simple equation of **Energy In vs. Energy Out**.\n\n- **Caloric Surplus**: Eating more than you burn -> Weight Gain\n- **Caloric Deficit**: Eating less than you burn -> Weight Loss\n- **Maintenance**: Eating exactly what you burn -> Weight Stable\n\nMost people underestimate how much they eat by 30-50%. Tracking gives you data, not judgment.',
  50,
  '[
    {"question": "What is the primary driver of weight loss?", "options": ["Eating cleanly", "Caloric Deficit", "Cardio", "Avoiding sugar"], "correct": 1},
    {"question": "If you eat 2500 kcal and burn 2000 kcal, you are in a:", "options": ["Deficit", "Surplus", "Maintenance", "Starvation mode"], "correct": 1},
    {"question": "How accurate are people at guessing their calorie intake?", "options": ["Very accurate", "They overestimate", "They underestimate by 30-50%", "Perfectly accurate"], "correct": 2}
  ]'::jsonb
),
(
  'Protein: The Building Block', 1, 'Nutrition Basics', 2,
  '# Why Protein Matters\n\nProtein is the only macronutrient that builds muscle tissue. It also has the highest **Thermic Effect of Food (TEF)**, meaning your body burns more calories digesting protein than fats or carbs.\n\n**Best Sources:**\n- Chicken Breast (Leanc)\n- Eggs (High Bioavailability)\n- Whey Protein (Fast Absorption)\n- Lentils & Beans (Plant-based)',
  50,
  '[
    {"question": "Which macronutrient builds muscle?", "options": ["Carbs", "Fats", "Protein", "Alcohol"], "correct": 2},
    {"question": "What is the Thermic Effect of Food (TEF)?", "options": ["Food making you cold", "Calories burned digesting food", "Food making you sleepy", "None of the above"], "correct": 1}
  ]'::jsonb
),
(
  'Carbs & Performance', 1, 'Nutrition Basics', 3,
  '# Carbs are Fuel\n\nCarbohydrates are your body''s preferred energy source for high-intensity training. They are stored in your muscles as **Glycogen**.\n\n- **Simple Carbs**: Fast energy (Fruit, Sugar). Good pre-workout.\n- **Complex Carbs**: Slow energy (Oats, Rice). Good for sustained fuel.\n\nDon''t fear carbs; just earn them with your activity!',
  50,
  '[
    {"question": "Stored carbohydrates in muscles are called:", "options": ["Fat", "Glycogen", "Protein", "Water"], "correct": 1},
    {"question": "When are simple carbs most useful?", "options": ["Before bed", "Pre/Intra Workout", "Rest days", "Never"], "correct": 1}
  ]'::jsonb
);

-- 3. Insert Unit 2: Training Mechanics
INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, xp_reward, questions) VALUES
(
  'Progressive Overload', 2, 'Training Mechanics', 1,
  '# The Golden Rule of Gains\n\nDoing the same workout with the same weights for months will result in... the same body. To grow, you must force your body to adapt.\n\n**Ways to Overload:**\n1. Increase Weight (Intensity)\n2. Increase Reps (Volume)\n3. Decrease Rest (Density)\n4. Better Form (Efficiency)\n\nYou don''t need to PR every session, but the trend must be upwards.',
  75,
  '[
    {"question": "What happens if you never increase your weights?", "options": ["You get huge", "You maintain", "You get injured", "You lose fat"], "correct": 1},
    {"question": "Which is a valid form of progressive overload?", "options": ["Doing less reps", "Resting longer", "Decreasing rest time", "Skipping leg day"], "correct": 2}
  ]'::jsonb
),
(
  'Understanding RPE', 2, 'Training Mechanics', 2,
  '# Rating of Perceived Exertion\n\nRPE is a scale of 1-10 on how hard a set was.\n\n- **RPE 10**: Maximum effort, 0 reps left in tank.\n- **RPE 9**: 1 rep left in reserve (RIR).\n- **RPE 8**: 2 reps left in reserve.\n\nMost growth happens at **RPE 7-9**. If you stop at RPE 5, you are mostly doing cardio, not building muscle.',
  75,
  '[
    {"question": "What does RPE 10 mean?", "options": ["Easy warmup", "Could do 5 more", "Absolute failure", "Cardio pace"], "correct": 2},
    {"question": "For muscle growth, sets should be:", "options": ["RPE 1-3", "RPE 7-9", "RPE 5", "As easy as possible"], "correct": 1}
  ]'::jsonb
);

-- 4. Insert Unit 3: Recovery
INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, xp_reward, questions) VALUES
(
  'Sleep: The Natural Steroid', 3, 'Recovery', 1,
  '# Use It or Lose It\n\nYou don''t grow in the gym; you grow while you sleep. The gym provides the stimulus (damage), and sleep provides the repair (growth).\n\nIf you train hard but sleep 5 hours, you are wasting your effort. Aim for **7-9 hours** of quality sleep.',
  100,
  '[
    {"question": "When does muscle growth actually occur?", "options": ["During the set", "While sleeping", "While driving", "While eating"], "correct": 1},
    {"question": "What is the recommended sleep duration for athletes?", "options": ["4-5 hours", "6 hours", "7-9 hours", "12+ hours"], "correct": 2}
  ]'::jsonb
);
