-- Keep public routine prescriptions separate from private workout logs.
ALTER TABLE published_splits ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE published_splits ADD COLUMN IF NOT EXISTS source_split_id UUID REFERENCES user_splits(id) ON DELETE SET NULL;
ALTER TABLE published_splits ADD COLUMN IF NOT EXISTS training_plan JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS published_splits_author_source ON published_splits(author_id, source_split_id);

CREATE TABLE IF NOT EXISTS published_split_hearts (
    split_id UUID NOT NULL REFERENCES published_splits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (split_id, user_id)
);
CREATE INDEX IF NOT EXISTS published_split_hearts_user ON published_split_hearts(user_id);
-- Reactions are served through the authenticated API; never expose the voter list.
ALTER TABLE published_split_hearts ENABLE ROW LEVEL SECURITY;
