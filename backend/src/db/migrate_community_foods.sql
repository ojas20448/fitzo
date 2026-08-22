-- Community food catalog — the user-writable half of the global food database.
--
-- WHY THIS IS NOT user_foods AND NOT indian-foods.json
--
-- user_foods (migrate_user_foods.sql) is a deliberate private island: AI macro
-- guesses scoped to one member so a wrong estimate can only ever mislead the
-- person who created it. That property is load-bearing and is NOT relaxed here.
--
-- indian-foods.json is a curated file baked into the image at build time. It
-- cannot be written at runtime — the process holds a pre-tokenised in-memory
-- index of it (services/indianFood.js), Render's filesystem is ephemeral, and
-- with more than one instance a write on one dyno is invisible to the others.
--
-- So a third store: rows that are globally visible like the curated catalog,
-- but attributed, revocable and re-rankable like user data. Community foods
-- surface in /api/food/search alongside the curated set, always tagged with
-- source='community' so the client can mark them as member-contributed.
--
-- MODERATION MODEL: auto-publish, flag-driven takedown.
-- A submission is live the moment it is accepted. There is no review queue and
-- no in-app moderator. Three defences keep the pollution that
-- scripts/purge_fabricated_foods.js had to clean up by hand from recurring:
--   1. submit-time dedupe against both the curated catalog and this table,
--   2. submit-time macro-vs-calorie arithmetic check (services/communityFoods),
--   3. distinct-user flagging that auto-hides at COMMUNITY_FLAG_THRESHOLD.
-- Cleanup and graduation into the curated JSON are CLI operations:
--   node scripts/moderate_community_foods.js --help

CREATE TABLE IF NOT EXISTS community_foods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- SET NULL not CASCADE: a deleted account must not silently delete food
    -- rows other members are already logging against.
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,

    name          VARCHAR(255) NOT NULL,
    category      VARCHAR(100) NOT NULL DEFAULT 'Other',
    region        VARCHAR(100) NOT NULL DEFAULT 'All India',
    serving_size  VARCHAR(100) NOT NULL,

    calories INTEGER      NOT NULL CHECK (calories >= 0   AND calories <= 5000),
    protein  NUMERIC(6,1) NOT NULL CHECK (protein  >= 0   AND protein  <= 500),
    carbs    NUMERIC(6,1) NOT NULL CHECK (carbs    >= 0   AND carbs    <= 500),
    fat      NUMERIC(6,1) NOT NULL CHECK (fat      >= 0   AND fat      <= 500),
    fiber    NUMERIC(6,1) NOT NULL DEFAULT 0 CHECK (fiber >= 0 AND fiber <= 200),

    -- live    → visible in global search (the state every row starts in)
    -- hidden  → auto-hidden by flags, or hidden by CLI; recoverable
    -- removed → CLI tombstone; kept so calorie_logs FKs and audit survive
    status VARCHAR(16) NOT NULL DEFAULT 'live'
        CHECK (status IN ('live', 'hidden', 'removed')),

    -- Denormalised counter kept in step with community_food_flags by the
    -- service layer. Read on every search row; recomputing it per query is
    -- the kind of join that makes food search slow.
    flag_count INTEGER NOT NULL DEFAULT 0,

    -- How many times anyone has logged this. Drives CLI --promote ranking:
    -- a food logged 200 times has earned a place in the curated JSON.
    log_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One row per food name across the WHOLE catalog, not per user. This is the
-- global namespace; two members submitting "Ragi Dosa" must collide so the
-- second is redirected to the first instead of forking the entry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_foods_name
    ON community_foods (lower(name));

-- Covers the search hot path: status filter + name match.
CREATE INDEX IF NOT EXISTS idx_community_foods_live
    ON community_foods (status, lower(name));

CREATE INDEX IF NOT EXISTS idx_community_foods_submitter
    ON community_foods (submitted_by);

-- Trigram index makes the ILIKE '%term%' candidate sweep in
-- services/communityFoods.search() an index scan instead of a seq scan.
-- Guarded: a managed Postgres role without CREATE EXTENSION rights must not
-- fail the whole migration run — ILIKE still works, just linearly.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS idx_community_foods_name_trgm
        ON community_foods USING GIN (lower(name) gin_trgm_ops);
EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'pg_trgm unavailable — community food search falls back to sequential ILIKE';
END $$;

-- One flag per (food, member). Without the unique index a single account can
-- drive flag_count past the threshold alone and unilaterally hide any food.
CREATE TABLE IF NOT EXISTS community_food_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    food_id UUID NOT NULL REFERENCES community_foods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason  VARCHAR(32) NOT NULL DEFAULT 'other'
        CHECK (reason IN ('wrong_macros', 'duplicate', 'not_a_food', 'spam', 'other')),
    note    VARCHAR(280),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_food_flags_unique
    ON community_food_flags (food_id, user_id);

CREATE INDEX IF NOT EXISTS idx_community_food_flags_food
    ON community_food_flags (food_id);

-- Provenance on the log row, mirroring the existing user_food_id column.
-- Lets the app badge a logged entry as community-sourced and lets the CLI
-- count real usage rather than trusting log_count alone.
ALTER TABLE calorie_logs
    ADD COLUMN IF NOT EXISTS community_food_id UUID
    REFERENCES community_foods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calorie_logs_community_food
    ON calorie_logs (community_food_id);
