ALTER TABLE teacher_accounts
  ADD COLUMN password_hash text,
  ADD COLUMN session_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT teacher_accounts_password_hash_not_blank
    CHECK (password_hash IS NULL OR btrim(password_hash) <> ''),
  ADD CONSTRAINT teacher_accounts_session_version_positive
    CHECK (session_version > 0);

-- The sealed cookie carries only a random session ID. This server-side row lets
-- logout revoke one device without signing the teacher out on every device.
CREATE TABLE teacher_sessions (
  id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES teacher_accounts(id) ON DELETE RESTRICT,
  session_version integer NOT NULL CHECK (session_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX teacher_sessions_active_lookup
  ON teacher_sessions (teacher_id, expires_at)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON teacher_sessions TO lab002_app;
