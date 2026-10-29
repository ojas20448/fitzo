CREATE TABLE IF NOT EXISTS ai_usage_counters (
    key TEXT PRIMARY KEY,
    used BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_counters_expiry ON ai_usage_counters (expires_at);
ALTER TABLE ai_usage_counters ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE api_role TEXT; BEGIN
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
        EXECUTE format('REVOKE ALL ON ai_usage_counters FROM %I', api_role);
    END LOOP;
END $$;
