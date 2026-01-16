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
