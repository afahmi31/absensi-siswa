DO $migration$
BEGIN
  IF current_user <> 'lab002_migrator' THEN
    RAISE EXCEPTION '0005 must run as lab002_migrator';
  END IF;
  IF to_regrole('lab002_app') IS NULL THEN
    RAISE EXCEPTION 'The lab002_app runtime role must exist before migrations run';
  END IF;
END
$migration$;

-- Only the server runtime needs the application schema. Supabase API roles may
-- still exist, but must not be able to reach any student or audit object.
REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO lab002_migrator;
GRANT USAGE ON SCHEMA public TO lab002_app;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM lab002_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM lab002_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM lab002_app;

DO $migration$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(api_role) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;

-- The application is the only row-level-security principal. Its SQL remains
-- server-only; no tenant data is being exposed through the Supabase Data API.
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
  END LOOP;

  FOREACH app_table IN ARRAY ARRAY[
    'schools', 'school_classes', 'semesters', 'students', 'semester_memberships',
    'school_calendar_rules', 'calendar_exceptions', 'attendance_records',
    'teacher_sessions', 'semester_archive_snapshots'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY lab002_app_access ON public.%I FOR ALL TO lab002_app USING (true) WITH CHECK (true)',
      app_table
    );
  END LOOP;

  EXECUTE 'CREATE POLICY lab002_app_access ON public.teacher_accounts FOR SELECT TO lab002_app USING (true)';
  EXECUTE 'CREATE POLICY lab002_app_access ON public.audit_events FOR SELECT TO lab002_app USING (true)';
END
$migration$;

GRANT SELECT ON public.teacher_accounts, public.audit_events TO lab002_app;
GRANT SELECT ON public.effective_attendance TO lab002_app;
GRANT SELECT, INSERT, UPDATE ON
  public.schools,
  public.school_classes,
  public.semesters,
  public.students,
  public.semester_memberships,
  public.school_calendar_rules,
  public.calendar_exceptions,
  public.attendance_records,
  public.teacher_sessions,
  public.semester_archive_snapshots
TO lab002_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM lab002_app;

GRANT EXECUTE ON FUNCTION public.school_local_today(uuid) TO lab002_app;
GRANT EXECUTE ON FUNCTION public.is_school_day(uuid, date) TO lab002_app;
GRANT EXECUTE ON FUNCTION public.lock_school_calendar(uuid) TO lab002_app;
GRANT EXECUTE ON FUNCTION public.lock_school_calendar_date(uuid, date) TO lab002_app;
ALTER VIEW public.effective_attendance SET (security_invoker = true);

CREATE SCHEMA private AUTHORIZATION lab002_migrator;
REVOKE ALL PRIVILEGES ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO lab002_app;

DO $migration$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(api_role) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA private FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;

-- New application migrations must grant each new object explicitly. Functions
-- created by the migrator do not inherit PostgreSQL's PUBLIC EXECUTE default.
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM lab002_app;
ALTER DEFAULT PRIVILEGES FOR ROLE lab002_migrator IN SCHEMA public REVOKE ALL ON SEQUENCES FROM lab002_app;
