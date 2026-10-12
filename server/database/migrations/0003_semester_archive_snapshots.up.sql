ALTER TABLE semesters
  ADD CONSTRAINT semesters_academic_year_consecutive
  CHECK (
    CASE
      WHEN academic_year ~ '^[0-9]{4}/[0-9]{4}$' THEN
        split_part(academic_year, '/', 1)::integer BETWEEN 1 AND 9998
        AND split_part(academic_year, '/', 2)::integer = split_part(academic_year, '/', 1)::integer + 1
      ELSE false
    END
  );

CREATE TABLE semester_archive_snapshots (
  semester_id uuid PRIMARY KEY REFERENCES semesters(id) ON DELETE RESTRICT,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  school_name text NOT NULL CHECK (btrim(school_name) <> ''),
  class_name text NOT NULL CHECK (btrim(class_name) <> ''),
  academic_year text NOT NULL CHECK (btrim(academic_year) <> ''),
  term semester_term NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_on >= starts_on)
);

INSERT INTO semester_archive_snapshots (
  semester_id, school_name, class_name, academic_year, term, starts_on, ends_on
)
SELECT semester.id, school.name, school_class.name, semester.academic_year,
       semester.term, semester.starts_on, semester.ends_on
FROM semesters AS semester
JOIN schools AS school ON school.id = semester.school_id
JOIN school_classes AS school_class ON school_class.school_id = school.id
WHERE semester.status = 'closed';

-- Semester closure uses lock 1728 before the calendar and row locks. Existing
-- STUD/DB calendar guards use 1728 here so their row-level guards cannot race
-- closure or take the locks in the opposite order.
CREATE FUNCTION lock_semester_scope_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_school_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  IF TG_TABLE_NAME IN ('semesters', 'school_calendar_rules', 'calendar_exceptions') THEN
    FOR v_school_id IN
      SELECT DISTINCT value::uuid
      FROM (VALUES (v_old ->> 'school_id'), (v_new ->> 'school_id')) AS candidate(value)
      WHERE value IS NOT NULL
      ORDER BY value::uuid
    LOOP
      PERFORM pg_advisory_xact_lock(1728, hashtext(v_school_id::text));
    END LOOP;
  ELSIF TG_TABLE_NAME = 'semester_memberships' THEN
    FOR v_school_id IN
      SELECT DISTINCT semester.school_id
      FROM semesters AS semester
      WHERE semester.id IN (
        NULLIF(v_old ->> 'semester_id', '')::uuid,
        NULLIF(v_new ->> 'semester_id', '')::uuid
      )
      ORDER BY semester.school_id
    LOOP
      PERFORM pg_advisory_xact_lock(1728, hashtext(v_school_id::text));
    END LOOP;
  ELSIF TG_TABLE_NAME = 'attendance_records' THEN
    FOR v_school_id IN
      SELECT DISTINCT membership.school_id
      FROM semester_memberships AS membership
      WHERE membership.id IN (
        NULLIF(v_old ->> 'membership_id', '')::uuid,
        NULLIF(v_new ->> 'membership_id', '')::uuid
      )
      ORDER BY membership.school_id
    LOOP
      PERFORM pg_advisory_xact_lock(1728, hashtext(v_school_id::text));
    END LOOP;
  ELSIF TG_TABLE_NAME = 'students' AND TG_OP = 'UPDATE' THEN
    FOR v_school_id IN
      SELECT DISTINCT semester.school_id
      FROM semester_memberships AS membership
      JOIN semesters AS semester ON semester.id = membership.semester_id
      WHERE membership.student_id = OLD.id AND semester.status = 'active'
      ORDER BY semester.school_id
    LOOP
      PERFORM pg_advisory_xact_lock(1728, hashtext(v_school_id::text));
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER aa_semesters_scope_lock
  BEFORE INSERT OR UPDATE OR DELETE ON semesters
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE TRIGGER aa_semester_memberships_scope_lock
  BEFORE INSERT OR UPDATE OR DELETE ON semester_memberships
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE TRIGGER aa_attendance_records_scope_lock
  BEFORE INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE TRIGGER aa_school_calendar_rules_scope_lock
  BEFORE INSERT OR UPDATE OR DELETE ON school_calendar_rules
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE TRIGGER aa_calendar_exceptions_scope_lock
  BEFORE INSERT OR UPDATE OR DELETE ON calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE TRIGGER aa_students_scope_lock
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION lock_semester_scope_writes();

CREATE FUNCTION guard_semester_period_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.starts_on IS NOT DISTINCT FROM OLD.starts_on
     AND NEW.ends_on IS NOT DISTINCT FROM OLD.ends_on THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM semester_memberships AS membership
    WHERE membership.semester_id = OLD.id
      AND (
        membership.starts_on < NEW.starts_on
        OR membership.starts_on > NEW.ends_on
        OR (membership.ends_on IS NOT NULL AND (
          membership.ends_on < NEW.starts_on
          OR membership.ends_on > NEW.ends_on
        ))
      )
  ) THEN
    RAISE EXCEPTION 'semester dates cannot exclude an existing student membership' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM attendance_records AS attendance
    WHERE attendance.semester_id = OLD.id
      AND (attendance.attendance_date < NEW.starts_on OR attendance.attendance_date > NEW.ends_on)
  ) THEN
    RAISE EXCEPTION 'semester dates cannot exclude attendance history' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER semesters_guard_period_change
  BEFORE UPDATE OF starts_on, ends_on ON semesters
  FOR EACH ROW EXECUTE FUNCTION guard_semester_period_change();

CREATE FUNCTION require_semester_closure_confirmation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'closed'
     AND current_setting('app.semester_closure_confirmed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'semester closure requires explicit confirmation' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER semesters_require_closure_confirmation
  BEFORE UPDATE OF status ON semesters
  FOR EACH ROW EXECUTE FUNCTION require_semester_closure_confirmation();

CREATE FUNCTION guard_semester_archive_snapshot_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_semester_status semester_status;
  v_academic_year text;
  v_term semester_term;
  v_starts_on date;
  v_ends_on date;
  v_school_name text;
  v_class_name text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'semester archive snapshots are immutable' USING ERRCODE = '55000';
  END IF;

  IF current_setting('app.semester_closure_confirmed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'semester archive snapshots can only be created during confirmed closure' USING ERRCODE = '55000';
  END IF;

  SELECT semester.status, semester.academic_year, semester.term, semester.starts_on, semester.ends_on,
         school.name, school_class.name
    INTO v_semester_status, v_academic_year, v_term, v_starts_on, v_ends_on, v_school_name, v_class_name
  FROM semesters AS semester
  JOIN schools AS school ON school.id = semester.school_id
  JOIN school_classes AS school_class ON school_class.school_id = school.id
  WHERE semester.id = NEW.semester_id
  FOR SHARE OF school, school_class;

  IF NOT FOUND OR v_semester_status <> 'closed'
     OR NEW.school_name IS DISTINCT FROM v_school_name
     OR NEW.class_name IS DISTINCT FROM v_class_name
     OR NEW.academic_year IS DISTINCT FROM v_academic_year
     OR NEW.term IS DISTINCT FROM v_term
     OR NEW.starts_on IS DISTINCT FROM v_starts_on
     OR NEW.ends_on IS DISTINCT FROM v_ends_on THEN
    RAISE EXCEPTION 'semester archive snapshot must match a closed semester and its school data' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER semester_archive_snapshots_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON semester_archive_snapshots
  FOR EACH ROW EXECUTE FUNCTION guard_semester_archive_snapshot_write();

CREATE FUNCTION capture_semester_archive_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_name text;
  v_class_name text;
BEGIN
  IF OLD.status <> 'active' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT school.name, school_class.name
    INTO v_school_name, v_class_name
  FROM schools AS school
  JOIN school_classes AS school_class ON school_class.school_id = school.id
  WHERE school.id = NEW.school_id
  FOR SHARE OF school, school_class;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school and class details are required to archive a semester' USING ERRCODE = '23503';
  END IF;

  INSERT INTO semester_archive_snapshots (
    semester_id, school_name, class_name, academic_year, term, starts_on, ends_on
  ) VALUES (
    NEW.id, v_school_name, v_class_name, NEW.academic_year, NEW.term, NEW.starts_on, NEW.ends_on
  );

  RETURN NEW;
END
$$;

CREATE TRIGGER semesters_capture_archive_snapshot
  AFTER UPDATE OF status ON semesters
  FOR EACH ROW WHEN (OLD.status = 'active' AND NEW.status = 'closed')
  EXECUTE FUNCTION capture_semester_archive_snapshot();

CREATE TRIGGER semester_archive_snapshots_audit
  AFTER INSERT OR UPDATE OR DELETE ON semester_archive_snapshots
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();

GRANT SELECT, INSERT, UPDATE ON semester_archive_snapshots TO lab002_app;
