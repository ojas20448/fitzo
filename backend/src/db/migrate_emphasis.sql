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
