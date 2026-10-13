DO $migration$
BEGIN
  IF current_user <> 'lab002_migrator' THEN
    RAISE EXCEPTION '0006 must run as lab002_migrator';
  END IF;
END
$migration$;

CREATE TABLE private.login_throttle_attempts (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  failure_count integer NOT NULL CHECK (failure_count BETWEEN 1 AND 5),
  blocked_until timestamptz,
  expires_at timestamptz NOT NULL,
  CHECK (blocked_until IS NULL OR blocked_until >= window_started_at)
);

CREATE INDEX login_throttle_expiry_lookup
  ON private.login_throttle_attempts (expires_at);

ALTER TABLE private.login_throttle_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab002_app_access ON private.login_throttle_attempts
  FOR ALL TO lab002_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON private.login_throttle_attempts TO lab002_app;

DO $migration$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(api_role) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE private.login_throttle_attempts FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
