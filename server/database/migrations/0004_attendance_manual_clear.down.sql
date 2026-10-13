DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM attendance_records
    WHERE exclusion_reason = 'manual_clear'
  ) OR EXISTS (
    SELECT 1
    FROM audit_events
    WHERE entity_type = 'attendance_records'
      AND (
        old_value ->> 'exclusion_reason' = 'manual_clear'
        OR new_value ->> 'exclusion_reason' = 'manual_clear'
      )
  ) THEN
    RAISE EXCEPTION 'cannot roll back attendance manual-clear history without deleting audit data' USING ERRCODE = '55000';
  END IF;
END
$$;

ALTER TABLE attendance_records
  DROP CONSTRAINT attendance_records_check,
  DROP CONSTRAINT attendance_records_exclusion_reason_check,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_exclusion_reason_check
    CHECK (exclusion_reason IS NULL OR exclusion_reason = 'calendar_holiday'),
  ADD CONSTRAINT attendance_records_check
    CHECK (
      (is_effective AND exclusion_reason IS NULL AND excluded_at IS NULL AND excluded_by_calendar_exception_id IS NULL)
      OR
      (NOT is_effective AND exclusion_reason IS NOT NULL AND excluded_at IS NOT NULL AND excluded_by_calendar_exception_id IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION guard_attendance_write()
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
