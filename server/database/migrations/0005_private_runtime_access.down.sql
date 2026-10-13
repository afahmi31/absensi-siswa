-- Rollback is used only by the local managed-cluster tool. Public/API revocations
-- are intentionally retained so a rollback cannot reopen Data API access.
DO $migration$
DECLARE
  app_table text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'teacher_accounts', 'schools', 'school_classes', 'semesters', 'students',
    'semester_memberships', 'school_calendar_rules', 'calendar_exceptions',
    'attendance_records', 'teacher_sessions', 'semester_archive_snapshots', 'audit_events',
    'schema_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', app_table);
  END LOOP;

  FOREACH app_table IN ARRAY ARRAY[
    'teacher_accounts', 'schools', 'school_classes', 'semesters', 'students',
    'semester_memberships', 'school_calendar_rules', 'calendar_exceptions',
    'attendance_records', 'teacher_sessions', 'semester_archive_snapshots', 'audit_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS lab002_app_access ON public.%I', app_table);
  END LOOP;
END
$migration$;

ALTER VIEW public.effective_attendance RESET (security_invoker);
REVOKE ALL PRIVILEGES ON SCHEMA private FROM lab002_app;
DROP SCHEMA IF EXISTS private;
GRANT USAGE ON SCHEMA public TO lab002_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lab002_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lab002_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO lab002_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_events FROM lab002_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO lab002_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lab002_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO lab002_app;
