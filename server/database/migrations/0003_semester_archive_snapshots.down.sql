DROP TRIGGER IF EXISTS semester_archive_snapshots_audit ON semester_archive_snapshots;
DROP TRIGGER IF EXISTS semester_archive_snapshots_guard_write ON semester_archive_snapshots;
DROP TRIGGER IF EXISTS semesters_capture_archive_snapshot ON semesters;
DROP TRIGGER IF EXISTS semesters_require_closure_confirmation ON semesters;
DROP TRIGGER IF EXISTS semesters_guard_period_change ON semesters;
DROP TRIGGER IF EXISTS aa_students_scope_lock ON students;
DROP TRIGGER IF EXISTS aa_calendar_exceptions_scope_lock ON calendar_exceptions;
DROP TRIGGER IF EXISTS aa_school_calendar_rules_scope_lock ON school_calendar_rules;
DROP TRIGGER IF EXISTS aa_attendance_records_scope_lock ON attendance_records;
DROP TRIGGER IF EXISTS aa_semester_memberships_scope_lock ON semester_memberships;
DROP TRIGGER IF EXISTS aa_semesters_scope_lock ON semesters;

DROP FUNCTION IF EXISTS capture_semester_archive_snapshot();
DROP FUNCTION IF EXISTS guard_semester_archive_snapshot_write();
DROP FUNCTION IF EXISTS require_semester_closure_confirmation();
DROP FUNCTION IF EXISTS guard_semester_period_change();
DROP FUNCTION IF EXISTS lock_semester_scope_writes();

DROP TABLE IF EXISTS semester_archive_snapshots;
ALTER TABLE semesters DROP CONSTRAINT IF EXISTS semesters_academic_year_consecutive;
