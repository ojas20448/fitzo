-- Learn becomes a library. The lock was never in the database — it was
-- iteration order in learn.js — so nothing is dropped here. These columns add
-- the vocabulary a browsable library needs and the schema never had.

ALTER TABLE learn_lessons
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connects_to VARCHAR(40),
  ADD COLUMN IF NOT EXISTS read_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_lesson_topics ON learn_lessons USING GIN (topics);

-- Dismissal of the optional "Start here" strip, following the
-- users.share_logs_default pattern.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS learn_start_here_dismissed BOOLEAN NOT NULL DEFAULT false;

-- Read time derived once here rather than per request.
-- chars/5 ~= words, /200 wpm * 60 = seconds, floored at 30.
UPDATE learn_lessons
   SET read_seconds = GREATEST(30, ROUND(length(content) / 5.0 / 200.0 * 60))
 WHERE content IS NOT NULL AND read_seconds IS NULL;

-- Topic + connection map. Editorial assignments from the design spec.
-- Matched by title (all 22 are unique). An unmatched title updates zero rows,
-- which is a deliberate no-op so a future retitle cannot break a deploy.
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}', connects_to = 'nutrition_targets' WHERE title = 'Energy Balance Equation';
UPDATE learn_lessons SET topics = '{nutrition,muscle}',   connects_to = 'food_log'           WHERE title = 'Protein: The Building Block';
UPDATE learn_lessons SET topics = '{nutrition,training}', connects_to = 'food_log'           WHERE title = 'Carbohydrates & Performance';
UPDATE learn_lessons SET topics = '{nutrition}',          connects_to = 'food_log'           WHERE title = 'Fats: The Essential Macro';
UPDATE learn_lessons SET topics = '{training,muscle}',    connects_to = 'volume'             WHERE title = 'Progressive Overload';
UPDATE learn_lessons SET topics = '{training}',           connects_to = 'rir'                WHERE title = 'Understanding RPE';
UPDATE learn_lessons SET topics = '{training,muscle}',    connects_to = 'volume'             WHERE title = 'Training Volume';
UPDATE learn_lessons SET topics = '{training,recovery}',  connects_to = 'rest_timer'         WHERE title = 'Rest Between Sets';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Hypertrophy 101';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Rep Ranges Explained';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Mind-Muscle Connection';
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}', connects_to = 'nutrition_targets' WHERE title = 'Creating a Sustainable Deficit';
UPDATE learn_lessons SET topics = '{training,fat-loss}' WHERE title = 'Cardio: LISS vs HIIT';
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}' WHERE title = 'Metabolic Adaptation';
UPDATE learn_lessons SET topics = '{supplements,nutrition}' WHERE title = 'What Actually Works';
UPDATE learn_lessons SET topics = '{supplements,nutrition}' WHERE title = 'What to Skip';
UPDATE learn_lessons SET topics = '{recovery}'          WHERE title = 'Sleep: The Natural Steroid';
UPDATE learn_lessons SET topics = '{recovery,training}' WHERE title = 'Active Recovery';
UPDATE learn_lessons SET topics = '{mindset}'           WHERE title = 'Building Unbreakable Habits';
UPDATE learn_lessons SET topics = '{mindset,training}'  WHERE title = 'Dealing with Plateaus';
UPDATE learn_lessons SET topics = '{training}'          WHERE title = 'Periodization Basics';
UPDATE learn_lessons SET topics = '{training,recovery}' WHERE title = 'Deload Weeks';
