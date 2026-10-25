CREATE TABLE IF NOT EXISTS user_exercise_preferences (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL CHECK (char_length(exercise_name) BETWEEN 1 AND 100),
    note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
    rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 1800),
    PRIMARY KEY (user_id, exercise_name)
);

-- Private settings are accessed through the authenticated backend only.
ALTER TABLE user_exercise_preferences ENABLE ROW LEVEL SECURITY;
