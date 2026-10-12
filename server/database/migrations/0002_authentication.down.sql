DROP TABLE teacher_sessions;

ALTER TABLE teacher_accounts
  DROP CONSTRAINT teacher_accounts_session_version_positive,
  DROP CONSTRAINT teacher_accounts_password_hash_not_blank,
  DROP COLUMN session_version,
  DROP COLUMN password_hash;
