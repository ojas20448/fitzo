-- Remembers which cooking medium a member picks for a given dish, so the
-- app stops asking. Keyed on a normalised food NAME because calorie_logs
-- stores no food_id.

CREATE TABLE IF NOT EXISTS user_food_prefs (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_key     VARCHAR(120) NOT NULL,
  medium_id    VARCHAR(32)  NOT NULL,
  choice_count INTEGER      NOT NULL DEFAULT 1,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, food_key)
);

CREATE INDEX IF NOT EXISTS idx_user_food_prefs_user
  ON user_food_prefs (user_id);
