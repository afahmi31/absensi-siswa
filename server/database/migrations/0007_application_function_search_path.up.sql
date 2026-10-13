ALTER FUNCTION public.school_local_today(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.is_school_day(uuid, date)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.lock_school_calendar_date(uuid, date)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.lock_school_calendar(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validate_school_time_zone()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_semester_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_membership_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_student_identity_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.sync_active_membership_identity()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_calendar_rule_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_calendar_exception_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_attendance_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_audit_event_mutation()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.redact_audit_secrets(jsonb)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.lock_semester_scope_writes()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_semester_period_change()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.require_semester_closure_confirmation()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_semester_archive_snapshot_write()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.capture_semester_archive_snapshot()
  SET search_path = pg_catalog, public, pg_temp;
