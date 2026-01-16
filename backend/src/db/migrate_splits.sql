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
