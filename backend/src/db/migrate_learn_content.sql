-- Comprehensive Learn Content Migration
-- 8 Units, 22 Lessons, 80+ Questions
-- Last Updated: January 23, 2026

-- 1. Clean up old lessons
DELETE FROM learn_attempts;
DELETE FROM learn_lessons;

-- ========================================
-- UNIT 1: NUTRITION FUNDAMENTALS (4 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Energy Balance Equation', 1, 'Nutrition Fundamentals', 1,
  'Understanding calories in vs calories out',
  '# The Law of Thermodynamics

At its core, weight management is a simple equation:

**Energy In vs. Energy Out**

## The Three States

- **Caloric Surplus**: Eating more than you burn → Weight Gain
- **Caloric Deficit**: Eating less than you burn → Weight Loss  
- **Maintenance**: Eating exactly what you burn → Weight Stable

## Why Tracking Matters

Most people underestimate how much they eat by **30-50%**. A "healthy salad" with dressing and toppings can easily be 800+ calories.

Tracking gives you **data, not judgment**. It''s not about restriction—it''s about awareness.

## Key Numbers

- 1 pound of fat ≈ 3,500 calories
- To lose 1 lb/week = 500 cal deficit/day
- To gain 1 lb/week = 500 cal surplus/day

Remember: **You can''t out-train a bad diet.** A single meal can undo an entire workout.',
  50,
  '[
    {"question": "What is the primary driver of weight loss?", "options": ["Eating clean foods", "Caloric deficit", "Lots of cardio", "Avoiding sugar"], "correct": 1},
    {"question": "If you eat 2500 kcal and burn 2000 kcal daily, you are in a:", "options": ["Deficit", "Surplus", "Maintenance", "Starvation mode"], "correct": 1},
    {"question": "How accurate are people at estimating their calorie intake?", "options": ["Very accurate", "They overestimate", "They underestimate by 30-50%", "Perfectly accurate"], "correct": 2},
    {"question": "Approximately how many calories are in 1 pound of fat?", "options": ["1,000", "2,000", "3,500", "5,000"], "correct": 2}
  ]'::jsonb
),
(
  'Protein: The Building Block', 1, 'Nutrition Fundamentals', 2,
  'Why protein is king for body composition',
  '# Why Protein Matters Most

Protein is the **only macronutrient** that directly builds and repairs muscle tissue.

## Thermic Effect of Food (TEF)

Your body burns calories just digesting food:
- **Protein**: 20-35% of calories burned digesting
- **Carbs**: 5-10% burned
- **Fats**: 0-3% burned

This means eating 100 calories of protein costs ~25 calories to digest!

## How Much Do You Need?

- **Sedentary**: 0.8g per kg of body weight
- **Active/Lifting**: 1.6-2.2g per kg (0.7-1g per lb)
- **Dieting**: Even higher to preserve muscle

## Best Sources

| Source | Protein per 100g |
|--------|-----------------|
| Chicken Breast | 31g |
| Eggs | 13g |
| Greek Yogurt | 10g |
| Lentils | 9g |

**Pro tip**: Spread protein across 4-5 meals for optimal muscle protein synthesis.',
  50,
  '[
    {"question": "Which macronutrient directly builds muscle?", "options": ["Carbohydrates", "Fats", "Protein", "Fiber"], "correct": 2},
    {"question": "What is the Thermic Effect of Food (TEF)?", "options": ["Food making you cold", "Calories burned digesting food", "Food making you sleepy", "Storing fat"], "correct": 1},
    {"question": "For active lifters, recommended protein intake is:", "options": ["0.3g per kg", "0.8g per kg", "1.6-2.2g per kg", "5g per kg"], "correct": 2},
    {"question": "Which food has the highest protein per 100g?", "options": ["Eggs", "Greek Yogurt", "Chicken Breast", "Lentils"], "correct": 2}
  ]'::jsonb
),
(
  'Carbohydrates & Performance', 1, 'Nutrition Fundamentals', 3,
  'Fuel for high-intensity training',
  '# Carbs Are Your Fuel

Carbohydrates are your body''s **preferred energy source** for high-intensity training.

## Glycogen: Your Muscle Battery

Carbs are stored in your muscles as **glycogen**. When you lift heavy or sprint, your body taps into these stores first.

Low glycogen = Poor performance, fatigue, weakness

## Simple vs Complex Carbs

**Simple Carbs** (Fast Energy)
- Fruit, sugar, white bread
- Best: Pre/intra-workout
- Quick spike, quick drop

**Complex Carbs** (Sustained Energy)
- Oats, brown rice, sweet potato
- Best: Regular meals
- Slow, steady energy

## When to Eat Carbs

- **Pre-workout** (1-2 hrs before): Complex carbs for sustained energy
- **Post-workout**: Simple + complex for recovery
- **Before bed**: Okay! Can actually improve sleep

Don''t fear carbs—**earn them** with your activity level!',
  50,
  '[
    {"question": "Where are carbohydrates stored in your body?", "options": ["As fat cells", "As glycogen in muscles", "In your blood only", "In your bones"], "correct": 1},
    {"question": "When are simple carbs most beneficial?", "options": ["Before bed", "Pre/intra workout", "Rest days only", "Never"], "correct": 1},
    {"question": "Low glycogen stores typically cause:", "options": ["Better focus", "Fatigue and weakness", "Weight loss", "Muscle gain"], "correct": 1},
    {"question": "Which is a complex carbohydrate?", "options": ["White sugar", "Candy", "Sweet potato", "Soda"], "correct": 2}
  ]'::jsonb
),
(
  'Fats: The Essential Macro', 1, 'Nutrition Fundamentals', 4,
  'Why you need fat in your diet',
  '# Don''t Fear Fat

Dietary fat is **essential** for hormone production, brain function, and absorbing vitamins A, D, E, and K.

## The Truth About Fat

- Fat doesn''t make you fat—**excess calories** do
- Low-fat diets can crash testosterone and energy
- Fat keeps you full longer (high satiety)

## Types of Fat

**Good Fats (Prioritize)**
- Omega-3s: Salmon, walnuts, flaxseed
- Monounsaturated: Olive oil, avocado, almonds

**Limit These**
- Trans fats: Fried foods, processed snacks
- Excessive saturated: Fatty meats, butter

## How Much?

- **Minimum**: 0.5g per kg body weight (for hormones)
- **Optimal**: 25-35% of total calories
- Don''t go below 20% long-term

## Pro Tips

- Cook with olive or avocado oil
- Eat fatty fish 2x per week for omega-3s
- Nuts are calorie-dense—measure portions!',
  50,
  '[
    {"question": "What does dietary fat help produce?", "options": ["Glycogen", "Hormones", "Muscle fiber", "Carbohydrates"], "correct": 1},
    {"question": "Which vitamin requires fat for absorption?", "options": ["Vitamin C", "Vitamin B12", "Vitamin D", "Vitamin B6"], "correct": 2},
    {"question": "What is a good source of Omega-3 fatty acids?", "options": ["Chicken breast", "White rice", "Salmon", "Bread"], "correct": 2},
    {"question": "What happens with very low-fat diets long-term?", "options": ["Better gains", "Hormone issues", "Nothing", "More energy"], "correct": 1}
  ]'::jsonb
);

-- ========================================
-- UNIT 2: TRAINING ESSENTIALS (4 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Progressive Overload', 2, 'Training Essentials', 1,
  'The golden rule for making gains',
  '# The Golden Rule of Gains

Doing the same workout with the same weights for months will result in... **the same body**.

To grow, you must **force your body to adapt**.

## What is Progressive Overload?

Gradually increasing the stress placed on your muscles over time.

## Ways to Overload

1. **Increase Weight** (Intensity)
2. **Increase Reps** (Volume)
3. **Add Sets** (Volume)
4. **Decrease Rest** (Density)
5. **Better Form** (Efficiency)

## The Key Insight

You don''t need to PR every session. But over weeks and months, **the trend must be upward**.

## Practical Example

Week 1: Bench 60kg × 8 reps
Week 2: Bench 60kg × 9 reps
Week 3: Bench 60kg × 10 reps
Week 4: Bench 62.5kg × 8 reps ← Progress!

**Track your lifts.** If you''re not measuring, you''re guessing.',
  75,
  '[
    {"question": "What happens if you never increase your training stress?", "options": ["You get huge", "You maintain/plateau", "You automatically gain", "You get injured"], "correct": 1},
    {"question": "Which is a valid form of progressive overload?", "options": ["Doing fewer reps", "Resting longer between sets", "Decreasing rest time", "Skipping workouts"], "correct": 2},
    {"question": "How often should you hit a PR?", "options": ["Every session", "Every week", "Trend upward over months", "Never"], "correct": 2},
    {"question": "Why should you track your lifts?", "options": ["It''s optional", "To compare with others", "To measure progress objectively", "Social media"], "correct": 2}
  ]'::jsonb
),
(
  'Understanding RPE', 2, 'Training Essentials', 2,
  'Rating your effort for optimal training',
  '# Rating of Perceived Exertion

RPE is a scale of 1-10 measuring **how hard a set was**.

## The RPE Scale

| RPE | Description | Reps in Reserve |
|-----|-------------|-----------------|
| 10 | Maximum effort | 0 reps left |
| 9 | Very hard | 1 rep left |
| 8 | Hard | 2 reps left |
| 7 | Moderate | 3 reps left |
| 6 | Light | 4+ reps left |

## Why RPE Matters

- **RPE 7-9**: The growth zone
- **RPE 5-6**: Warm-up territory
- **RPE 10**: Use sparingly (injury risk)

## Common Mistakes

❌ Training every set to failure (RPE 10)
❌ Never pushing hard enough (RPE 5-6)
❌ Not adjusting for fatigue/stress

## Better Approach

- Most working sets: RPE 7-8
- Last set of exercise: RPE 9
- Save RPE 10 for testing days

**Effort matters more than the number on the bar.**',
  75,
  '[
    {"question": "What does RPE 10 mean?", "options": ["Easy warmup", "Could do 5 more reps", "Absolute maximum effort", "Cardio pace"], "correct": 2},
    {"question": "For muscle growth, most sets should be:", "options": ["RPE 1-3", "RPE 7-9", "Always RPE 10", "RPE 5"], "correct": 1},
    {"question": "What does RIR stand for?", "options": ["Rest In Recovery", "Reps In Reserve", "Rate of Internal Response", "Really Intense Reps"], "correct": 1},
    {"question": "Training every set to failure (RPE 10) is:", "options": ["Required for gains", "Risky and fatiguing", "The only way to grow", "Relaxing"], "correct": 1}
  ]'::jsonb
),
(
  'Training Volume', 2, 'Training Essentials', 3,
  'How many sets do you actually need?',
  '# Volume: The Driver of Growth

Training volume = **Sets × Reps × Weight**

But for simplicity, we count **hard sets per muscle group per week**.

## Research-Backed Guidelines

| Level | Sets/Muscle/Week |
|-------|-----------------|
| Beginner | 10-12 sets |
| Intermediate | 12-18 sets |
| Advanced | 18-25+ sets |

## Key Principles

1. **Minimum Effective Dose**: Start at 10 sets
2. **Maximum Recoverable Volume**: 20-25 sets ceiling
3. **Progressive Overload**: Add 1-2 sets over time

## Volume Landmarks

- **MV (Maintenance Volume)**: ~6 sets/week
- **MEV (Minimum Effective)**: ~10 sets/week  
- **MAV (Maximum Adaptive)**: ~15-20 sets/week
- **MRV (Maximum Recoverable)**: 20-25+ sets/week

## Practical Tips

- Split volume across 2 sessions per muscle
- More isn''t always better—recovery matters
- Track fatigue: If performance drops, reduce volume',
  75,
  '[
    {"question": "Training volume is measured by:", "options": ["Only weight lifted", "Only reps performed", "Hard sets per muscle per week", "Hours in gym"], "correct": 2},
    {"question": "Recommended weekly sets for intermediates:", "options": ["1-5 sets", "6-9 sets", "12-18 sets", "50+ sets"], "correct": 2},
    {"question": "What is MRV?", "options": ["Minimum Recovery Volume", "Maximum Recoverable Volume", "Muscle Recovery Velocity", "Maximum Rep Velocity"], "correct": 1},
    {"question": "If your performance is dropping, you should:", "options": ["Add more volume", "Reduce volume", "Skip gym entirely", "Ignore it"], "correct": 1}
  ]'::jsonb
),
(
  'Rest Between Sets', 2, 'Training Essentials', 4,
  'Optimal rest for your goals',
  '# Rest Periods Matter

How long you rest between sets affects your results.

## Rest Period Guidelines

| Goal | Rest Time |
|------|-----------|
| Strength (1-5 reps) | 3-5 minutes |
| Hypertrophy (6-12 reps) | 60-90 seconds |
| Endurance (15+ reps) | 30-60 seconds |

## Why Rest Matters

**Too Short**:
- Can''t lift as heavy
- Form breaks down
- Less total volume

**Too Long**:
- Muscles cool down
- Workouts take forever
- Less metabolic stress

## The Science: ATP Replenishment

- 50% ATP restored: ~30 seconds
- 85% ATP restored: ~90 seconds
- 95% ATP restored: ~3 minutes

## Practical Approach

- **Compound lifts** (squat, deadlift, bench): 2-3 min
- **Isolation** (curls, laterals): 60-90 sec
- **Supersets**: Move between exercises, rest after pair

Don''t scroll your phone for 10 minutes between sets!',
  75,
  '[
    {"question": "For hypertrophy (muscle building), rest:", "options": ["30 seconds", "60-90 seconds", "5 minutes", "10 minutes"], "correct": 1},
    {"question": "What happens if you rest too little between sets?", "options": ["Better pump", "Can''t lift as heavy", "Faster gains", "More strength"], "correct": 1},
    {"question": "How long for 95% ATP replenishment?", "options": ["30 seconds", "1 minute", "3 minutes", "10 minutes"], "correct": 2},
    {"question": "For heavy compound lifts, rest:", "options": ["30 seconds", "60 seconds", "2-3 minutes", "Never"], "correct": 2}
  ]'::jsonb
);

-- ========================================
-- UNIT 3: MUSCLE BUILDING (3 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Hypertrophy 101', 3, 'Muscle Building', 1,
  'The science of muscle growth',
  '# How Muscles Grow

Hypertrophy = **increase in muscle cell size**

## The Three Drivers

1. **Mechanical Tension** (Most Important)
   - Heavy weights, challenging loads
   - Time under tension

2. **Metabolic Stress**
   - The "pump" and burn
   - Higher reps, shorter rest

3. **Muscle Damage**
   - Micro-tears from training
   - Causes soreness (not required!)

## The Growth Process

1. Training creates stimulus (damage/stress)
2. Body senses threat, starts repair
3. Protein synthesis increases (eating protein!)
4. Muscle repairs slightly larger/stronger
5. Repeat with progressive overload

## Common Myths Busted

❌ Muscle grows in the gym → Actually grows during rest
❌ More sore = more growth → Not necessarily
❌ Need to "confuse" muscles → Consistency beats variety

**Build 0.5-1 lb muscle/month as a natural (best case)**',
  75,
  '[
    {"question": "Hypertrophy means:", "options": ["Muscle loss", "Increase in muscle cell size", "Fat gain", "Flexibility"], "correct": 1},
    {"question": "The most important driver of muscle growth is:", "options": ["Soreness", "Mechanical tension", "Cardio", "Supplements"], "correct": 1},
    {"question": "When does muscle actually grow?", "options": ["During the workout", "During rest and recovery", "Only at night", "Never"], "correct": 1},
    {"question": "As a natural, realistic muscle gain is:", "options": ["5 lbs/week", "10 lbs/month", "0.5-1 lb/month", "20 lbs/month"], "correct": 2}
  ]'::jsonb
),
(
  'Rep Ranges Explained', 3, 'Muscle Building', 2,
  'Low reps vs high reps for your goals',
  '# The Rep Range Debate

Different rep ranges emphasize different adaptations.

## The Classic Breakdown

| Reps | Primary Benefit |
|------|-----------------|
| 1-5 | Strength |
| 6-12 | Hypertrophy |
| 12-20 | Endurance/Pump |
| 20+ | Endurance |

## The Truth

**All rep ranges can build muscle** if taken close to failure (RPE 7-9).

The "hypertrophy range" of 6-12 is practical, not magical:
- Heavy enough for tension
- Light enough for volume
- Good balance of both

## Best Approach: Use All Ranges

- **Compounds** (squat, bench, row): 5-8 reps
- **Accessories** (curls, extensions): 8-15 reps
- **Isolation/Pump** (laterals, calves): 12-20 reps

## Why Variety Helps

- Different muscle fibers respond to different stimuli
- Prevents boredom and overuse injuries
- Keeps training fresh and challenging

The best rep range is one you can **progressively overload**.',
  75,
  '[
    {"question": "1-5 reps primarily build:", "options": ["Endurance", "Strength", "Flexibility", "Speed"], "correct": 1},
    {"question": "Can high reps (15+) build muscle?", "options": ["Never", "Yes, if close to failure", "Only with steroids", "Only for beginners"], "correct": 1},
    {"question": "The 6-12 rep range is popular because:", "options": ["It''s magical", "Good balance of tension and volume", "Scientists said so", "It''s easier"], "correct": 1},
    {"question": "For isolation exercises like curls, use:", "options": ["1-3 reps", "8-15 reps", "100 reps", "Only bodyweight"], "correct": 1}
  ]'::jsonb
),
(
  'Mind-Muscle Connection', 3, 'Muscle Building', 3,
  'Focus and feel for better gains',
  '# Mind-Muscle Connection

The ability to **consciously focus on and feel** a specific muscle working.

## Why It Matters

Research shows focusing on the target muscle can increase activation by **20%+**.

Same exercise, same weight = more growth potential.

## How to Develop It

1. **Slow Down**: Use 2-3 second eccentrics
2. **Lighten Up**: Ego aside, feel the muscle
3. **Pause at Peak**: Squeeze at the top
4. **Touch the Muscle**: Physically tap it during warmups
5. **Close Your Eyes**: Remove visual distractions

## When It Matters Most

- **Isolation exercises**: Curls, lateral raises, leg extensions
- **Lagging body parts**: Extra focus needed
- **Warmup sets**: Practice connection with light weight

## When to Ignore It

- **Heavy compounds**: Focus on form/safety first
- **Max effort sets**: Just move the weight
- **Beginners**: Learn movement patterns first

**The pump is feedback—chase the feeling, not the weight.**',
  75,
  '[
    {"question": "Mind-muscle connection can increase muscle activation by:", "options": ["0%", "5%", "20%+", "100%"], "correct": 2},
    {"question": "To develop mind-muscle connection, you should:", "options": ["Lift as fast as possible", "Slow down and feel the muscle", "Use maximum weight", "Skip warmups"], "correct": 1},
    {"question": "Mind-muscle connection matters most for:", "options": ["Heavy deadlifts", "Isolation exercises", "Cardio", "Stretching"], "correct": 1},
    {"question": "A good cue for improving connection is:", "options": ["Lift explosively", "Close your eyes and focus", "Talk to friends", "Watch TV"], "correct": 1}
  ]'::jsonb
);

-- ========================================
-- UNIT 4: FAT LOSS SCIENCE (3 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Creating a Sustainable Deficit', 4, 'Fat Loss Science', 1,
  'The right way to lose fat',
  '# Fat Loss Made Simple

Fat loss = **Caloric Deficit**. Period.

No special food, timing, or supplement changes this fundamental truth.

## Calculate Your Deficit

1. Find maintenance calories (TDEE)
2. Subtract 300-500 calories
3. That''s your target

## Rate of Fat Loss

| Deficit | Weekly Loss | Best For |
|---------|-------------|----------|
| 250 cal | 0.5 lb | Lean individuals |
| 500 cal | 1 lb | Most people |
| 750+ cal | 1.5+ lb | Obese individuals |

## Keys to Sustainability

✅ **Don''t crash diet**: Larger deficits = more muscle loss
✅ **Prioritize protein**: 1g per lb to preserve muscle
✅ **Keep lifting heavy**: Signal to body: "keep the muscle"
✅ **Diet breaks**: 1-2 weeks at maintenance every 8-12 weeks

## Red Flags

🚩 Constantly hungry
🚩 Poor sleep and recovery
🚩 Strength dropping weekly
🚩 Mood/energy tanking

If you''re experiencing these, **eat more**.',
  75,
  '[
    {"question": "What determines fat loss?", "options": ["Eating clean", "Caloric deficit", "Avoiding carbs after 6pm", "Special supplements"], "correct": 1},
    {"question": "A safe weekly fat loss rate for most people is:", "options": ["5 lbs", "0.5-1 lb", "3 lbs", "10 lbs"], "correct": 1},
    {"question": "During a diet, protein intake should be:", "options": ["Lower", "The same", "Higher", "Zero"], "correct": 2},
    {"question": "If you''re constantly hungry and strength is dropping, you should:", "options": ["Push through", "Eat more", "Do more cardio", "Skip meals"], "correct": 1}
  ]'::jsonb
),
(
  'Cardio: LISS vs HIIT', 4, 'Fat Loss Science', 2,
  'Which cardio is best for fat loss?',
  '# The Cardio Debate

Both work. Choose based on your preferences and recovery.

## LISS (Low Intensity Steady State)

**Examples**: Walking, cycling, swimming (steady pace)
**Heart Rate**: 60-70% max
**Duration**: 30-60+ minutes

**Pros**:
- Easy to recover from
- Can do daily
- Low injury risk
- Good for active recovery

## HIIT (High Intensity Interval Training)

**Examples**: Sprints, cycling intervals, burpees
**Heart Rate**: 80-95% max
**Duration**: 15-25 minutes

**Pros**:
- Time efficient
- Afterburn effect (EPOC)
- Improves conditioning fast

## The Verdict

**For Fat Loss**: Both burn calories. LISS is easier to sustain.
**For Muscle Retention**: LISS is less fatiguing.
**For Time**: HIIT wins.

## Best Approach

- 2-3x LISS (walking 8-10k steps daily)
- 1-2x HIIT (if you enjoy it)
- Prioritize lifting > cardio

**The best cardio is the one you''ll actually do consistently.**',
  75,
  '[
    {"question": "LISS stands for:", "options": ["Low Intensity Speed Sessions", "Low Intensity Steady State", "Long Interval Sprint Sessions", "Light Internal Strength System"], "correct": 1},
    {"question": "HIIT is best when:", "options": ["You have limited time", "You want easy recovery", "You''re injured", "You hate exercise"], "correct": 0},
    {"question": "For muscle retention during fat loss, prefer:", "options": ["Only HIIT", "LISS", "No cardio ever", "Running marathons"], "correct": 1},
    {"question": "The best cardio for fat loss is:", "options": ["Only running", "Only cycling", "Whichever you''ll do consistently", "Only swimming"], "correct": 2}
  ]'::jsonb
),
(
  'Metabolic Adaptation', 4, 'Fat Loss Science', 3,
  'Why progress stalls and how to fix it',
  '# When Fat Loss Stalls

Your body is smart. It adapts to conserve energy during prolonged dieting.

## What is Metabolic Adaptation?

As you lose weight, your body:
- Burns fewer calories at rest
- Moves less (NEAT decreases)
- Becomes more efficient
- Increases hunger hormones

## Signs of Adaptation

📉 Fat loss stalled for 2+ weeks
📉 Constantly tired and cold
📉 Workouts feel harder
📉 Sleep quality drops
📉 Hunger is unmanageable

## How to Break Plateaus

1. **Drop calories slightly** (100-200 more)
2. **Add cardio** (increase NEAT first)
3. **Take a diet break** (1-2 weeks at maintenance)
4. **Refeed days** (higher carb day weekly)

## Reverse Dieting

After a diet, **slowly increase calories** back to maintenance over 4-8 weeks.

Why?
- Restores metabolic rate
- Prevents rapid fat regain
- Rebuilds diet hormones

**Patience is the ultimate diet hack.**',
  75,
  '[
    {"question": "Metabolic adaptation means your body:", "options": ["Burns more calories", "Burns fewer calories over time", "Builds muscle faster", "Needs more water"], "correct": 1},
    {"question": "NEAT stands for:", "options": ["Nutrition Eating And Tracking", "Non-Exercise Activity Thermogenesis", "New Energy Absorption Theory", "Nothing"], "correct": 1},
    {"question": "A diet break is:", "options": ["Quitting forever", "1-2 weeks at maintenance calories", "Eating everything", "Skipping meals"], "correct": 1},
    {"question": "After a diet, you should:", "options": ["Stay at low calories forever", "Reverse diet slowly", "Immediately eat double", "Start another diet"], "correct": 1}
  ]'::jsonb
);

-- ========================================
-- UNIT 5: SUPPLEMENTS 101 (2 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'What Actually Works', 5, 'Supplements 101', 1,
  'Evidence-based supplements worth your money',
  '# Supplements That Work

Most supplements are **overhyped garbage**. But a few actually work.

## Tier 1: Strong Evidence

**Creatine Monohydrate**
- Most researched supplement ever
- Increases strength 5-10%
- Improves muscle gain
- 5g daily, no loading needed
- Cheap and safe

**Protein Powder**
- Convenient protein source
- No magic properties
- Use if you can''t hit protein from food
- Whey, casein, or plant-based all work

**Caffeine**
- Improves performance 2-5%
- Reduces perceived effort
- 3-6mg per kg body weight
- Take 30-60 min before training

## Tier 2: Some Evidence

**Vitamin D**: If deficient (most people are)
**Fish Oil**: If you don''t eat fatty fish
**Melatonin**: For sleep (0.5-3mg)

**Spend 90% of your effort on food, training, and sleep first.**',
  100,
  '[
    {"question": "The most researched supplement is:", "options": ["BCAAs", "Fat burners", "Creatine monohydrate", "Testosterone boosters"], "correct": 2},
    {"question": "Recommended daily creatine dose:", "options": ["50g", "20g", "5g", "1g"], "correct": 2},
    {"question": "Protein powder is:", "options": ["Magical muscle builder", "Convenient protein source", "Dangerous", "Only for pros"], "correct": 1},
    {"question": "When should you take caffeine before training?", "options": ["Immediately before", "30-60 minutes before", "After workout", "Never"], "correct": 1}
  ]'::jsonb
),
(
  'What to Skip', 5, 'Supplements 101', 2,
  'Don''t waste your money on these',
  '# Supplements to Avoid

The supplement industry is **largely unregulated**. Many products don''t contain what they claim.

## Skip These

**BCAAs (Branched Chain Amino Acids)**
- If you eat enough protein, BCAAs are redundant
- Whey protein contains all BCAAs anyway
- Waste of money

**Fat Burners**
- Usually just caffeine + unproven herbs
- Can''t out-supplement a bad diet
- Some are dangerous (heart issues)

**Testosterone Boosters**
- Don''t work. At all.
- If they did, they''d be illegal
- Fix sleep, stress, and diet instead

**Mass Gainers**
- Just expensive calories
- Usually high sugar, low protein
- Eat real food instead

## Red Flags

🚩 "Proprietary blend" (hiding dosages)
🚩 Before/after photos (often fake)
🚩 "Revolutionary" or "breakthrough"
🚩 Claims that sound too good

**If it sounds too good to be true, it is.**',
  100,
  '[
    {"question": "BCAAs are unnecessary if you:", "options": ["Never exercise", "Eat enough protein", "Take creatine", "Sleep well"], "correct": 1},
    {"question": "Fat burners primarily contain:", "options": ["Magic compounds", "Caffeine and herbs", "Steroids", "Pure fat"], "correct": 1},
    {"question": "Testosterone boosters:", "options": ["Work great", "Are banned substances", "Don''t work", "Replace TRT"], "correct": 2},
    {"question": "A ''proprietary blend'' on a label means:", "options": ["High quality", "Hiding ingredient dosages", "FDA approved", "Natural ingredients"], "correct": 1}
  ]'::jsonb
);

-- ========================================
-- UNIT 6: SLEEP & RECOVERY (2 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Sleep: The Natural Steroid', 6, 'Sleep & Recovery', 1,
  'Why sleep is non-negotiable for gains',
  '# Sleep Is Gains

You don''t grow in the gym—**you grow while you sleep**.

The gym provides stimulus (damage). Sleep provides repair (growth).

## What Happens During Sleep

- **Growth hormone peaks** (muscle repair)
- **Testosterone production** (building)
- **Cortisol drops** (stress recovery)
- **Glycogen replenishes** (energy stores)
- **Memory consolidation** (learning movement patterns)

## How Much Sleep?

| Hours | Effect on Gains |
|-------|-----------------|
| <6 | Serious impairment |
| 6-7 | Suboptimal |
| 7-9 | Optimal for most |
| 9+ | If you need it |

## Sleep Optimization

✅ Same bedtime/waketime (even weekends)
✅ Dark, cool room (65-68°F / 18-20°C)
✅ No screens 1 hour before bed
✅ Caffeine cutoff by 2pm
✅ Magnesium before bed (optional)

## Sleep Deprivation Effects

- 10-15% strength decrease
- Increased injury risk
- More muscle loss during cuts
- Higher cravings and hunger

**Sleep is free. Use it.**',
  100,
  '[
    {"question": "When does muscle growth primarily occur?", "options": ["During the workout", "While sleeping", "While eating", "While stretching"], "correct": 1},
    {"question": "Optimal sleep duration for most people is:", "options": ["4-5 hours", "6 hours", "7-9 hours", "12 hours"], "correct": 2},
    {"question": "Sleep deprivation can decrease strength by:", "options": ["0%", "1%", "10-15%", "50%"], "correct": 2},
    {"question": "Caffeine cutoff should be:", "options": ["Right before bed", "6pm", "2pm or earlier", "Never drink caffeine"], "correct": 2}
  ]'::jsonb
),
(
  'Active Recovery', 6, 'Sleep & Recovery', 2,
  'Rest days done right',
  '# Rest Days = Growth Days

Recovery isn''t just sitting on the couch. **Active recovery** can speed up the process.

## What is Active Recovery?

Low-intensity movement that promotes blood flow without adding training stress.

## Active Recovery Options

- **Walking**: 20-30 minutes, light pace
- **Stretching/Yoga**: 15-20 minutes
- **Foam Rolling**: 10-15 minutes on tight areas
- **Swimming**: Easy laps
- **Light Cycling**: Low resistance

## Benefits

✅ Increases blood flow (nutrient delivery)
✅ Reduces muscle soreness (DOMS)
✅ Maintains movement habit
✅ Improves flexibility over time
✅ Mental break from intense training

## When to Take Complete Rest

- Feeling run down or getting sick
- Accumulated fatigue over weeks
- Sleep quality declining
- Motivation completely gone

## Weekly Structure

- **3-5 training days**
- **1-2 active recovery days**
- **1 complete rest day** (optional)

**Movement is medicine. Just keep it light on rest days.**',
  100,
  '[
    {"question": "Active recovery involves:", "options": ["Heavy lifting", "Low-intensity movement", "Complete bed rest", "HIIT"], "correct": 1},
    {"question": "Active recovery helps by:", "options": ["Building muscle directly", "Increasing blood flow", "Burning fat rapidly", "Replacing workouts"], "correct": 1},
    {"question": "When should you take complete rest?", "options": ["Every day", "When feeling run down or sick", "Never", "Only on weekends"], "correct": 1},
    {"question": "Good active recovery activities include:", "options": ["Sprinting", "Heavy squats", "Light walking and stretching", "Maximal deadlifts"], "correct": 2}
  ]'::jsonb
);

-- ========================================
-- UNIT 7: MINDSET & CONSISTENCY (2 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Building Unbreakable Habits', 7, 'Mindset & Consistency', 1,
  'Systems over motivation',
  '# Motivation Is Unreliable

You won''t always feel like training. That''s normal.

**Systems > Motivation**

## The 2-Day Rule

Never skip more than 2 days in a row.

- Missed Monday? Go Tuesday.
- Missed Tuesday? Wednesday is non-negotiable.

This keeps the habit alive even when life gets busy.

## Habit Stacking

Attach your gym habit to an existing routine:
- "After my morning coffee, I go to the gym"
- "After work, I drive to the gym before home"

## Environment Design

- Lay out gym clothes the night before
- Keep gym bag in your car
- Find a gym on your commute
- Remove friction from the process

## Identity Shift

Don''t say: "I''m trying to get fit"
Say: **"I am someone who works out"**

Small mindset shift, big behavior change.

## The Truth

- First 2 weeks: Hard (building habit)
- Week 3-6: Easier (becoming routine)
- After 8 weeks: Feels wrong NOT to go

**Discipline is choosing between what you want NOW and what you want MOST.**',
  100,
  '[
    {"question": "The 2-Day Rule means:", "options": ["Train twice daily", "Never skip more than 2 days in a row", "Only train 2 days a week", "Rest for 2 days"], "correct": 1},
    {"question": "Habit stacking involves:", "options": ["Doing multiple exercises", "Attaching new habits to existing routines", "Taking supplements", "Sleeping more"], "correct": 1},
    {"question": "An identity shift example is:", "options": ["''I''m trying to exercise''", "''I am someone who works out''", "''Maybe I''ll go tomorrow''", "''I hate the gym''"], "correct": 1},
    {"question": "How long until a habit feels automatic?", "options": ["1 day", "1 week", "8+ weeks", "Never"], "correct": 2}
  ]'::jsonb
),
(
  'Dealing with Plateaus', 7, 'Mindset & Consistency', 2,
  'When progress stalls',
  '# Plateaus Are Normal

Everyone hits them. It''s part of the journey.

## Types of Plateaus

1. **Strength plateau**: Lifts not increasing
2. **Scale plateau**: Weight not changing
3. **Physique plateau**: Not seeing changes
4. **Motivation plateau**: Lost interest

## Common Causes

- Not sleeping enough
- Life stress increased
- Diet adherence slipping
- Same program for too long
- Unrealistic expectations

## How to Break Through

### For Strength Plateaus
- Deload for a week (reduce volume 50%)
- Change rep ranges
- Try different exercises for same muscle

### For Fat Loss Plateaus
- Take a diet break (2 weeks at maintenance)
- Increase NEAT (walking)
- Reassess calorie tracking accuracy

### For Motivation Plateaus
- Change your routine/gym
- Find a training partner
- Set a new goal (sign up for event)
- Take a week completely off

## Perspective Check

Compare yourself to **1 year ago**, not yesterday.

Progress isn''t linear. **Zoom out.**',
  100,
  '[
    {"question": "Plateaus are:", "options": ["Signs you should quit", "Normal part of progress", "Only for beginners", "Caused by bad genetics"], "correct": 1},
    {"question": "A deload week involves:", "options": ["Training harder", "Reducing volume by 50%", "Not eating", "Only cardio"], "correct": 1},
    {"question": "For motivation plateaus, you should:", "options": ["Force yourself harder", "Change routine or find a partner", "Give up", "Take steroids"], "correct": 1},
    {"question": "Progress should be measured:", "options": ["Day to day", "Week to week", "Compared to 1 year ago", "Never"], "correct": 2}
  ]'::jsonb
);

-- ========================================
-- UNIT 8: ADVANCED TOPICS (2 lessons)
-- ========================================

INSERT INTO learn_lessons (title, unit, unit_title, order_index, description, content, xp_reward, questions) VALUES
(
  'Periodization Basics', 8, 'Advanced Topics', 1,
  'Programming for long-term progress',
  '# Periodization

The systematic planning of training to maximize gains and prevent plateaus.

## Why Periodize?

- Prevents adaptation/staleness
- Manages fatigue over time
- Allows for peaks and recovery
- Organized progress tracking

## Basic Periodization Models

### Linear Periodization
Start light and high reps → progressively heavier, lower reps

Week 1-4: 12-15 reps
Week 5-8: 8-12 reps
Week 9-12: 5-8 reps

### Undulating Periodization
Vary intensity throughout the week

Monday: Heavy (5 reps)
Wednesday: Moderate (10 reps)
Friday: Light (15 reps)

## Mesocycles

A training block lasting 4-8 weeks with a specific focus:
- **Hypertrophy block**: Higher volume, moderate weight
- **Strength block**: Lower volume, heavier weight
- **Peaking block**: Low volume, max intensity

## For Most Lifters

Don''t overcomplicate it:
- 4-6 week training blocks
- Deload every 4th or 8th week
- Change exercises slightly each block

**Consistency + progressive overload > fancy periodization**',
  100,
  '[
    {"question": "Periodization helps to:", "options": ["Make training random", "Prevent plateaus and manage fatigue", "Skip leg day", "Avoid the gym"], "correct": 1},
    {"question": "Linear periodization moves from:", "options": ["Heavy to light", "Light/high reps to heavy/low reps", "Random each day", "Only one rep range"], "correct": 1},
    {"question": "A mesocycle is:", "options": ["One workout", "4-8 week training block", "One year of training", "A type of cardio"], "correct": 1},
    {"question": "For most lifters, periodization should be:", "options": ["Extremely complex", "Simple: consistent blocks with deloads", "Ignored completely", "Changed daily"], "correct": 1}
  ]'::jsonb
),
(
  'Deload Weeks', 8, 'Advanced Topics', 2,
  'Why rest is productive',
  '# The Power of Deloading

A deload is a **planned reduction** in training stress to allow recovery.

## Why Deload?

Training creates fatigue. Over weeks, fatigue accumulates.

Without deloads:
- Performance drops
- Injury risk increases
- Mental burnout
- Overtraining symptoms

## How to Deload

**Option 1: Volume Deload**
- Same weight, 50% fewer sets
- Example: 4 sets → 2 sets

**Option 2: Intensity Deload**
- Same sets/reps, 60-70% of normal weight

**Option 3: Complete Rest**
- 4-7 days off (if you need it mentally)

## When to Deload

**Scheduled**: Every 4-8 weeks
**Reactive**: When you notice:
- 3+ sessions feeling unusually hard
- Joint aches lasting days
- Sleep quality dropping
- Motivation tanking

## Signs You Need a Deload NOW

🚩 Weights feel 20% heavier than normal
🚩 Elevated resting heart rate
🚩 Getting sick frequently
🚩 Dreading the gym

## After the Deload

You''ll come back **stronger**. This is supercompensation.

**Rest is part of training. Embrace it.**',
  100,
  '[
    {"question": "A deload is:", "options": ["Training harder", "Planned reduction in training stress", "Quitting the gym", "Eating less"], "correct": 1},
    {"question": "Deloads help prevent:", "options": ["Muscle growth", "Injury and burnout", "Fat loss", "Strength gains"], "correct": 1},
    {"question": "How often should you deload?", "options": ["Every workout", "Every 4-8 weeks", "Once a year", "Never"], "correct": 1},
    {"question": "After a deload, you should:", "options": ["Quit training", "Come back stronger", "Deload again", "Change sports"], "correct": 1}
  ]'::jsonb
);

-- Done! 22 lessons across 8 units with 80+ questions
