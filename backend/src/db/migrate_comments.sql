-- Create comments table for social interactions on workouts
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_workout ON comments(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

SELECT 'Comments table created' as status;
