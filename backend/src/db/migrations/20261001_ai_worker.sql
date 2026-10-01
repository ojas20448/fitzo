BEGIN;
CREATE TABLE IF NOT EXISTS ai_worker_state (
    id integer PRIMARY KEY CHECK (id = 1), paused_until timestamptz,
    pause_reason text, last_seen timestamptz
);
INSERT INTO ai_worker_state(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ai_worker_credentials (
    id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL,
    revoked boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_jobs (
    id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature text NOT NULL, idempotency_key text NOT NULL, input_hash text NOT NULL,
    payload jsonb, result jsonb, error_code text,
    status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','expired')),
    attempts integer NOT NULL DEFAULT 0, worker_id uuid REFERENCES ai_worker_credentials(id),
    lease_token uuid, lease_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
    finished_at timestamptz, UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ai_jobs_pending ON ai_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS ai_jobs_expiration ON ai_jobs(expires_at);
-- Backend-only tables; never expose them via a direct client database API.
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_worker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_worker_state ENABLE ROW LEVEL SECURITY;
COMMIT;
