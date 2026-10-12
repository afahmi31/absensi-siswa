CREATE TYPE attendance_status AS ENUM ('H', 'S', 'I', 'A');
CREATE TYPE semester_status AS ENUM ('active', 'closed');
CREATE TYPE semester_term AS ENUM ('ganjil', 'genap');
CREATE TYPE calendar_exception_kind AS ENUM ('holiday', 'school_day');

-- Login is a later task. This row represents the single teacher identity only.
CREATE TABLE teacher_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (btrim(email) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX teacher_accounts_email_lower_unique
  ON teacher_accounts (lower(btrim(email)));

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL UNIQUE REFERENCES teacher_accounts(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  logo_path text,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta' CHECK (btrim(time_zone) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE school_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, school_id)
);

CREATE TABLE semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_year text NOT NULL CHECK (btrim(academic_year) <> ''),
  term semester_term NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status semester_status NOT NULL DEFAULT 'active',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_on >= starts_on),
  CHECK ((status = 'active' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL)),
  UNIQUE (school_id, academic_year, term),
  UNIQUE (id, school_id)
);

CREATE UNIQUE INDEX semesters_one_active_per_school
  ON semesters (school_id)
  WHERE status = 'active';

CREATE INDEX semesters_period_lookup
  ON semesters (school_id, starts_on, ends_on);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  student_number text CHECK (student_number IS NULL OR btrim(student_number) <> ''),
  gender text CHECK (gender IS NULL OR gender IN ('L', 'P')),
  inactive_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- student_number and full_name intentionally are not unique. A name or blank NIPD
-- must never merge two different students.
CREATE TABLE semester_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  school_id uuid NOT NULL,
  school_class_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL CHECK (btrim(name_snapshot) <> ''),
  student_number_snapshot text CHECK (student_number_snapshot IS NULL OR btrim(student_number_snapshot) <> ''),
  gender_snapshot text CHECK (gender_snapshot IS NULL OR gender_snapshot IN ('L', 'P')),
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  FOREIGN KEY (semester_id, school_id) REFERENCES semesters(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (school_class_id, school_id) REFERENCES school_classes(id, school_id) ON DELETE RESTRICT,
  UNIQUE (semester_id, student_id),
  UNIQUE (id, semester_id)
);

CREATE INDEX semester_memberships_roster_lookup
  ON semester_memberships (semester_id, starts_on, ends_on);

CREATE TABLE school_calendar_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  effective_from date NOT NULL,
  is_school_day boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (school_id, day_of_week, effective_from)
);

CREATE INDEX school_calendar_rules_effective_lookup
  ON school_calendar_rules (school_id, day_of_week, effective_from DESC);

CREATE TABLE calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exception_date date NOT NULL,
  kind calendar_exception_kind NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (school_id, exception_date),
  UNIQUE (id, school_id, exception_date)
);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  attendance_date date NOT NULL,
  status attendance_status NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_effective boolean NOT NULL DEFAULT true,
  exclusion_reason text CHECK (exclusion_reason IS NULL OR exclusion_reason = 'calendar_holiday'),
  excluded_at timestamptz,
  excluded_by_calendar_exception_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (membership_id, semester_id) REFERENCES semester_memberships(id, semester_id) ON DELETE RESTRICT,
  FOREIGN KEY (excluded_by_calendar_exception_id) REFERENCES calendar_exceptions(id) ON DELETE RESTRICT,
  CHECK (
    (is_effective AND exclusion_reason IS NULL AND excluded_at IS NULL AND excluded_by_calendar_exception_id IS NULL)
    OR
    (NOT is_effective AND exclusion_reason IS NOT NULL AND excluded_at IS NOT NULL AND excluded_by_calendar_exception_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX attendance_one_effective_student_date
  ON attendance_records (membership_id, attendance_date)
  WHERE is_effective;

CREATE INDEX attendance_semester_date_lookup
  ON attendance_records (semester_id, attendance_date, membership_id);

CREATE VIEW effective_attendance AS
  SELECT attendance.id, attendance.membership_id, attendance.semester_id,
         attendance.attendance_date, attendance.status, attendance.version,
         attendance.recorded_at, attendance.updated_at
  FROM attendance_records AS attendance
  JOIN semester_memberships AS membership ON membership.id = attendance.membership_id
  JOIN semesters AS semester ON semester.id = attendance.semester_id
  WHERE attendance.is_effective
    AND attendance.attendance_date BETWEEN membership.starts_on AND COALESCE(membership.ends_on, 'infinity'::date)
    AND attendance.attendance_date BETWEEN semester.starts_on AND semester.ends_on;

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_teacher_id uuid REFERENCES teacher_accounts(id) ON DELETE RESTRICT,
  actor_kind text NOT NULL CHECK (actor_kind IN ('teacher', 'system')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  event_date date,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  old_value jsonb,
  new_value jsonb,
  CHECK ((actor_kind = 'teacher' AND actor_teacher_id IS NOT NULL) OR (actor_kind = 'system' AND actor_teacher_id IS NULL))
);

CREATE INDEX audit_events_entity_time_lookup
  ON audit_events (entity_type, entity_id, occurred_at DESC);

CREATE INDEX audit_events_date_lookup
  ON audit_events (event_date, occurred_at DESC);

CREATE FUNCTION school_local_today(p_school_id uuid)
RETURNS date
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT (statement_timestamp() AT TIME ZONE s.time_zone)::date
  FROM schools AS s
  WHERE s.id = p_school_id
$$;

CREATE FUNCTION is_school_day(p_school_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT CASE
    WHEN exception.kind IS NOT NULL THEN exception.kind = 'school_day'
    ELSE COALESCE(routine.is_school_day, false)
  END
  FROM (SELECT 1) AS seed
  LEFT JOIN LATERAL (
    SELECT e.kind
    FROM calendar_exceptions AS e
    WHERE e.school_id = p_school_id AND e.exception_date = p_date
  ) AS exception ON true
  LEFT JOIN LATERAL (
    SELECT r.is_school_day
    FROM school_calendar_rules AS r
    WHERE r.school_id = p_school_id
      AND r.day_of_week = EXTRACT(DOW FROM p_date)::smallint
      AND r.effective_from <= p_date
    ORDER BY r.effective_from DESC
    LIMIT 1
  ) AS routine ON true
$$;

CREATE FUNCTION lock_school_calendar_date(p_school_id uuid, p_date date)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
  SELECT pg_advisory_xact_lock(1729, hashtext(p_school_id::text || ':' || p_date::text))
$$;

CREATE FUNCTION lock_school_calendar(p_school_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
  SELECT pg_advisory_xact_lock(1727, hashtext(p_school_id::text))
$$;

CREATE FUNCTION validate_school_time_zone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names AS tz WHERE tz.name = NEW.time_zone) THEN
    RAISE EXCEPTION 'unknown school time zone' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER schools_validate_time_zone
  BEFORE INSERT OR UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION validate_school_time_zone();

CREATE FUNCTION guard_semester_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'closed semesters are immutable' USING ERRCODE = '55000';
    END IF;
    RAISE EXCEPTION 'semester rows are retained; close the semester instead' USING ERRCODE = '55000';
  END IF;

  v_school_id := NEW.school_id;
  PERFORM pg_advisory_xact_lock(1728, hashtext(v_school_id::text));

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'closed semesters are immutable' USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'closed' THEN
      IF (to_jsonb(NEW) - ARRAY['status', 'closed_at', 'updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'closed_at', 'updated_at']) THEN
        RAISE EXCEPTION 'only semester closure may change an active semester' USING ERRCODE = '55000';
      END IF;
      NEW.closed_at := COALESCE(NEW.closed_at, clock_timestamp());
    ELSIF NEW.status <> OLD.status OR NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
      RAISE EXCEPTION 'semester status cannot be reopened or changed directly' USING ERRCODE = '55000';
    END IF;
    NEW.updated_at := clock_timestamp();
    v_id := OLD.id;
  ELSE
    IF NEW.status <> 'active' OR NEW.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'new semesters must start active' USING ERRCODE = '23514';
    END IF;
    v_id := NEW.id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM semesters AS other
    WHERE other.school_id = NEW.school_id
      AND other.id <> v_id
      AND other.starts_on <= NEW.ends_on
      AND NEW.starts_on <= other.ends_on
  ) THEN
    RAISE EXCEPTION 'semester dates cannot overlap for a school' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER semesters_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON semesters
  FOR EACH ROW EXECUTE FUNCTION guard_semester_write();

CREATE FUNCTION guard_membership_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_semester_id uuid;
  v_semester_status semester_status;
  v_semester_start date;
  v_semester_end date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'semester memberships are retained; set an end date instead' USING ERRCODE = '55000';
  END IF;

  v_semester_id := NEW.semester_id;
  SELECT status, starts_on, ends_on
    INTO v_semester_status, v_semester_start, v_semester_end
  FROM semesters WHERE id = v_semester_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'semester does not exist' USING ERRCODE = '23503';
  END IF;
  IF v_semester_status = 'closed' THEN
    RAISE EXCEPTION 'closed semester memberships are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.starts_on < v_semester_start OR (NEW.ends_on IS NOT NULL AND NEW.ends_on > v_semester_end) THEN
    RAISE EXCEPTION 'membership dates must fall within its semester' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1
    FROM attendance_records AS attendance
    WHERE attendance.membership_id = OLD.id
      AND (
        attendance.attendance_date < NEW.starts_on
        OR (NEW.ends_on IS NOT NULL AND attendance.attendance_date > NEW.ends_on)
      )
  ) THEN
    RAISE EXCEPTION 'membership dates cannot exclude recorded attendance' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.semester_id <> OLD.semester_id OR NEW.school_id <> OLD.school_id OR NEW.school_class_id <> OLD.school_class_id OR NEW.student_id <> OLD.student_id) THEN
    RAISE EXCEPTION 'membership identity and period cannot be changed' USING ERRCODE = '55000';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER semester_memberships_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON semester_memberships
  FOR EACH ROW EXECUTE FUNCTION guard_membership_write();

CREATE FUNCTION guard_student_identity_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.student_number IS DISTINCT FROM OLD.student_number
     OR NEW.gender IS DISTINCT FROM OLD.gender THEN
    IF NOT EXISTS (
      SELECT 1
      FROM semester_memberships AS m
      JOIN semesters AS se ON se.id = m.semester_id
      WHERE m.student_id = OLD.id AND se.status = 'active'
    ) THEN
      RAISE EXCEPTION 'student identity can only be edited in an active semester' USING ERRCODE = '55000';
    END IF;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER students_guard_identity
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION guard_student_identity_write();

CREATE FUNCTION sync_active_membership_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.student_number IS DISTINCT FROM OLD.student_number
     OR NEW.gender IS DISTINCT FROM OLD.gender THEN
    UPDATE semester_memberships AS m
    SET name_snapshot = NEW.full_name,
        student_number_snapshot = NEW.student_number,
        gender_snapshot = NEW.gender
    FROM semesters AS se
    WHERE m.semester_id = se.id
      AND se.status = 'active'
      AND m.student_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER students_sync_active_membership_identity
  AFTER UPDATE OF full_name, student_number, gender ON students
  FOR EACH ROW EXECUTE FUNCTION sync_active_membership_identity();

CREATE FUNCTION guard_calendar_rule_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_effective_from date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'calendar rules are retained; add a future effective rule instead' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.school_id <> OLD.school_id OR NEW.day_of_week <> OLD.day_of_week OR NEW.effective_from <> OLD.effective_from) THEN
    RAISE EXCEPTION 'calendar rule identity cannot be changed' USING ERRCODE = '55000';
  END IF;

  v_school_id := NEW.school_id;
  v_effective_from := NEW.effective_from;
  PERFORM lock_school_calendar(v_school_id);

  -- Historical rule setup is allowed when it cannot rewrite an archived
  -- semester or attendance. A rule covers its effective date through the day
  -- before the next rule for the same school weekday.
  IF TG_OP = 'UPDATE' THEN
    SELECT min(effective_from) - 1 INTO v_effective_from
    FROM school_calendar_rules
    WHERE school_id = OLD.school_id
      AND day_of_week = OLD.day_of_week
      AND effective_from > OLD.effective_from;
    v_effective_from := COALESCE(v_effective_from, 'infinity'::date);
    IF NEW.is_school_day IS DISTINCT FROM OLD.is_school_day AND (
      EXISTS (
        SELECT 1 FROM semesters AS se
        WHERE se.school_id = OLD.school_id AND se.status = 'closed'
          AND se.starts_on <= v_effective_from AND OLD.effective_from <= se.ends_on
      )
      OR EXISTS (
        SELECT 1 FROM attendance_records AS a
        JOIN semester_memberships AS m ON m.id = a.membership_id
        WHERE m.school_id = OLD.school_id
          AND a.attendance_date >= OLD.effective_from
          AND a.attendance_date <= v_effective_from
          AND EXTRACT(DOW FROM a.attendance_date)::smallint = OLD.day_of_week
      )
    ) THEN
      RAISE EXCEPTION 'calendar rules cannot rewrite attendance or a closed semester' USING ERRCODE = '55000';
    END IF;
  ELSE
    SELECT min(effective_from) - 1 INTO v_effective_from
    FROM school_calendar_rules
    WHERE school_id = NEW.school_id
      AND day_of_week = NEW.day_of_week
      AND effective_from > NEW.effective_from;
    v_effective_from := COALESCE(v_effective_from, 'infinity'::date);
    IF EXISTS (
      SELECT 1 FROM semesters AS se
      WHERE se.school_id = NEW.school_id AND se.status = 'closed'
        AND se.starts_on <= v_effective_from AND NEW.effective_from <= se.ends_on
    ) THEN
      RAISE EXCEPTION 'calendar rules cannot rewrite a closed semester' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM attendance_records AS a
      JOIN semester_memberships AS m ON m.id = a.membership_id
      WHERE m.school_id = NEW.school_id
        AND a.attendance_date >= NEW.effective_from
        AND a.attendance_date <= v_effective_from
        AND EXTRACT(DOW FROM a.attendance_date)::smallint = NEW.day_of_week
    ) THEN
      RAISE EXCEPTION 'calendar rules cannot rewrite existing attendance dates' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER school_calendar_rules_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON school_calendar_rules
  FOR EACH ROW EXECUTE FUNCTION guard_calendar_rule_write();

CREATE FUNCTION guard_calendar_exception_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_date date;
  v_has_attendance boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'calendar exceptions are retained; update the exception instead' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.school_id <> OLD.school_id OR NEW.exception_date <> OLD.exception_date) THEN
    RAISE EXCEPTION 'calendar exception identity cannot be changed' USING ERRCODE = '55000';
  END IF;

  v_school_id := NEW.school_id;
  v_date := NEW.exception_date;
  PERFORM lock_school_calendar(v_school_id);
  PERFORM lock_school_calendar_date(v_school_id, v_date);
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND EXISTS (
    SELECT 1 FROM semesters AS se
    WHERE se.school_id = v_school_id AND se.status = 'closed'
      AND v_date BETWEEN se.starts_on AND se.ends_on
  ) THEN
    RAISE EXCEPTION 'calendar changes cannot rewrite a closed semester' USING ERRCODE = '55000';
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM attendance_records AS a
    JOIN semester_memberships AS m ON m.id = a.membership_id
    WHERE m.school_id = v_school_id AND a.attendance_date = v_date
  ) INTO v_has_attendance;

  IF (TG_OP = 'INSERT' OR NEW.kind IS DISTINCT FROM OLD.kind)
     AND v_has_attendance
     AND current_setting('app.calendar_change_confirmed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'changing a calendar date with attendance requires confirmation' USING ERRCODE = '55000';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.kind IS DISTINCT FROM OLD.kind)
     AND NEW.kind = 'holiday' AND EXISTS (
    SELECT 1
    FROM attendance_records AS a
    JOIN semester_memberships AS m ON m.id = a.membership_id
    WHERE m.school_id = v_school_id AND a.attendance_date = v_date AND a.is_effective
  ) AND current_setting('app.calendar_change_confirmed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'a holiday cannot include effective attendance without confirmation' USING ERRCODE = '55000';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER calendar_exceptions_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION guard_calendar_exception_write();

CREATE FUNCTION guard_attendance_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_time_zone text;
  v_semester_status semester_status;
  v_semester_start date;
  v_semester_end date;
  v_member_start date;
  v_member_end date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'attendance history is retained; exclude the record instead' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_effective = false THEN
      RAISE EXCEPTION 'excluded attendance rows are immutable; record a new attendance instead' USING ERRCODE = '55000';
    END IF;
    IF NEW.id <> OLD.id OR NEW.membership_id <> OLD.membership_id OR NEW.semester_id <> OLD.semester_id OR NEW.attendance_date <> OLD.attendance_date OR NEW.recorded_at <> OLD.recorded_at THEN
      RAISE EXCEPTION 'attendance identity and date cannot be changed' USING ERRCODE = '55000';
    END IF;
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'attendance version must increase by one' USING ERRCODE = '40001';
    END IF;
    IF NEW.is_effective = false THEN
      IF current_setting('app.calendar_change_confirmed', true) IS DISTINCT FROM 'on'
         OR NEW.exclusion_reason <> 'calendar_holiday'
         OR NEW.excluded_by_calendar_exception_id IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM calendar_exceptions AS exception
           JOIN semester_memberships AS membership ON membership.school_id = exception.school_id
           WHERE exception.id = NEW.excluded_by_calendar_exception_id
             AND exception.exception_date = NEW.attendance_date
             AND exception.kind = 'holiday'
             AND membership.id = NEW.membership_id
         ) THEN
        RAISE EXCEPTION 'excluding attendance requires a confirmed holiday change' USING ERRCODE = '55000';
      END IF;
      NEW.excluded_at := COALESCE(NEW.excluded_at, clock_timestamp());
    ELSIF NEW.exclusion_reason IS NOT NULL OR NEW.excluded_at IS NOT NULL OR NEW.excluded_by_calendar_exception_id IS NOT NULL THEN
      RAISE EXCEPTION 'effective attendance cannot have exclusion details' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.is_effective = false OR NEW.version <> 1 THEN
    RAISE EXCEPTION 'new attendance must be effective at version 1' USING ERRCODE = '23514';
  END IF;

  SELECT se.school_id, sc.time_zone, se.status, se.starts_on, se.ends_on, m.starts_on, m.ends_on
    INTO v_school_id, v_time_zone, v_semester_status, v_semester_start, v_semester_end, v_member_start, v_member_end
  FROM semester_memberships AS m
  JOIN semesters AS se ON se.id = m.semester_id
  JOIN schools AS sc ON sc.id = se.school_id
  WHERE m.id = NEW.membership_id AND m.semester_id = NEW.semester_id
  FOR SHARE OF m, se, sc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attendance membership does not exist' USING ERRCODE = '23503';
  END IF;
  PERFORM lock_school_calendar(v_school_id);
  PERFORM lock_school_calendar_date(v_school_id, NEW.attendance_date);
  IF v_semester_status <> 'active' THEN
    RAISE EXCEPTION 'closed semester attendance is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.attendance_date < v_semester_start OR NEW.attendance_date > v_semester_end THEN
    RAISE EXCEPTION 'attendance date is outside the semester' USING ERRCODE = '23514';
  END IF;
  IF NEW.attendance_date < v_member_start OR (v_member_end IS NOT NULL AND NEW.attendance_date > v_member_end) THEN
    RAISE EXCEPTION 'attendance date is outside the student membership' USING ERRCODE = '23514';
  END IF;
  IF NEW.attendance_date > (statement_timestamp() AT TIME ZONE v_time_zone)::date THEN
    RAISE EXCEPTION 'future attendance cannot be recorded' USING ERRCODE = '23514';
  END IF;
  IF NEW.is_effective AND NOT is_school_day(v_school_id, NEW.attendance_date) THEN
    RAISE EXCEPTION 'attendance can only be recorded on a school day' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER attendance_records_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION guard_attendance_write();

CREATE FUNCTION guard_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER audit_events_no_update_or_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION guard_audit_event_mutation();

CREATE FUNCTION append_row_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_entity jsonb;
  v_actor_id uuid;
  v_event_date date;
  v_event_type text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := redact_audit_secrets(to_jsonb(OLD));
    v_entity := v_old;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := redact_audit_secrets(to_jsonb(OLD));
    v_new := redact_audit_secrets(to_jsonb(NEW));
    v_entity := v_new;
  ELSE
    v_new := redact_audit_secrets(to_jsonb(NEW));
    v_entity := v_new;
  END IF;

  v_actor_id := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  v_event_date := COALESCE(
    NULLIF(v_entity ->> 'attendance_date', '')::date,
    NULLIF(v_entity ->> 'exception_date', '')::date,
    NULLIF(v_entity ->> 'effective_from', '')::date,
    NULLIF(v_entity ->> 'starts_on', '')::date
  );

  INSERT INTO audit_events (
    actor_teacher_id, actor_kind, entity_type, entity_id, event_type,
    event_date, old_value, new_value
  ) VALUES (
    v_actor_id,
    CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'teacher' END,
    TG_TABLE_NAME,
    (v_entity ->> 'id')::uuid,
    v_event_type,
    v_event_date,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION redact_audit_secrets(p_row jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  FROM jsonb_each(p_row) AS entry(key, value)
  WHERE lower(entry.key) = 'session_version'
     OR lower(entry.key) !~ '(session|password|passwd|secret|token|credential|api.?key|authenticator|otp|totp|recovery)'
$$;

CREATE TRIGGER teacher_accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON teacher_accounts
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER schools_audit
  AFTER INSERT OR UPDATE OR DELETE ON schools
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER school_classes_audit
  AFTER INSERT OR UPDATE OR DELETE ON school_classes
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER semesters_audit
  AFTER INSERT OR UPDATE OR DELETE ON semesters
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER students_audit
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER semester_memberships_audit
  AFTER INSERT OR UPDATE OR DELETE ON semester_memberships
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER school_calendar_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON school_calendar_rules
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER calendar_exceptions_audit
  AFTER INSERT OR UPDATE OR DELETE ON calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();
CREATE TRIGGER attendance_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION append_row_audit_event();

-- The migrator owns schema objects; runtime code receives DML only. The local
-- database bootstrap creates this role before migrations run.
GRANT USAGE ON SCHEMA public TO lab002_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lab002_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lab002_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO lab002_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO lab002_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lab002_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO lab002_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_events FROM lab002_app;
