import type postgres from 'postgres'
import { createHash } from 'node:crypto'
import { H3Error } from 'h3'
import type { AttendanceRecord } from './attendance.ts'
import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'
import { lockSchoolSemesterChanges } from './semesters.ts'

export type CalendarExceptionKind = 'holiday' | 'school_day'

export interface CalendarException {
  id: string
  school_id: string
  exception_date: string
  kind: CalendarExceptionKind
  note: string | null
}

export interface CalendarHolidayChange {
  exception: CalendarException
  excludedAttendance: AttendanceRecord[]
}

export interface SchoolCalendarView {
  school: { id: string; name: string; timeZone: string; className: string } | null
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active'
  } | null
  schoolLocalToday: string | null
  month: string | null
  routineRules: Array<{ dayOfWeek: number; effectiveFrom: string; isSchoolDay: boolean }>
  days: Array<{
    date: string
    dayOfWeek: number
    routineConfigured: boolean
    isSchoolDay: boolean
    exceptionKind: CalendarExceptionKind | null
    note: string | null
    attendanceHistoryCount: number
    effectiveAttendanceCount: number
  }>
}

export interface CalendarAttendanceImpact {
  attendanceHistoryCount: number
  effectiveAttendanceCount: number
}

export class CalendarOperationError extends H3Error {
  override readonly statusCode: number
  override readonly statusMessage: string
  override readonly data?: Record<string, unknown>

  constructor(statusCode: number, statusMessage: string, data?: Record<string, unknown>) {
    super(statusMessage)
    this.statusCode = statusCode
    this.statusMessage = statusMessage
    this.data = data
    this.name = 'CalendarOperationError'
  }
}

async function saveCalendarException(
  transaction: postgres.TransactionSql,
  input: {
    schoolId: string
    date: string
    kind: CalendarExceptionKind
    note?: string | null
  },
): Promise<CalendarException> {
  const hasNote = Object.prototype.hasOwnProperty.call(input, 'note')
  const [exception] = await transaction<CalendarException[]>`
    insert into calendar_exceptions (school_id, exception_date, kind, note)
    values (${input.schoolId}, ${input.date}, ${input.kind}, ${input.note ?? null})
    on conflict (school_id, exception_date)
    do update set kind = excluded.kind,
                  note = case when ${hasNote} then excluded.note else calendar_exceptions.note end
    returning id, school_id, exception_date, kind, note
  `
  if (!exception) throw new Error('Calendar exception was not saved.')
  return exception
}

export async function setCalendarException(
  database: DatabaseExecutor,
  input: {
    schoolId: string
    date: string
    kind: CalendarExceptionKind
    note?: string | null
    confirmedAttendanceImpact?: boolean
  },
): Promise<CalendarException> {
  if (input.kind === 'holiday') {
    return (await setCalendarHoliday(database, input)).exception
  }
  return inDatabaseTransaction(database, async (transaction) => {
    if (input.confirmedAttendanceImpact) {
      await transaction`select set_config('app.calendar_change_confirmed', 'on', true)`
    }
    return saveCalendarException(transaction, input)
  })
}

/** Mark a date as a holiday and exclude every effective attendance record on that date atomically. */
export async function setCalendarHoliday(
  database: DatabaseExecutor,
  input: {
    schoolId: string
    date: string
    note?: string | null
    confirmedAttendanceImpact?: boolean
  },
): Promise<CalendarHolidayChange> {
  return inDatabaseTransaction(database, async (transaction) => {
    if (input.confirmedAttendanceImpact) {
      await transaction`select set_config('app.calendar_change_confirmed', 'on', true)`
    }
    const exception = await saveCalendarException(transaction, { ...input, kind: 'holiday' })
    const excludedAttendance = await transaction<AttendanceRecord[]>`
      update attendance_records as attendance
      set version = attendance.version + 1,
          is_effective = false,
          exclusion_reason = 'calendar_holiday',
          excluded_at = clock_timestamp(),
          excluded_by_calendar_exception_id = ${exception.id}
      from semester_memberships as membership
      where attendance.membership_id = membership.id
        and attendance.is_effective
        and membership.school_id = ${input.schoolId}
        and attendance.attendance_date = ${input.date}
      returning attendance.id, attendance.membership_id, attendance.semester_id,
                attendance.attendance_date, attendance.status, attendance.version,
                attendance.is_effective
    `
    return { exception, excludedAttendance }
  })
}

export async function setRoutineSchoolDay(
  database: DatabaseExecutor,
  input: { schoolId: string; dayOfWeek: number; effectiveFrom: string; isSchoolDay: boolean },
): Promise<string> {
  const [rule] = await database<{ id: string }[]>`
    insert into school_calendar_rules (school_id, day_of_week, effective_from, is_school_day)
    values (${input.schoolId}, ${input.dayOfWeek}, ${input.effectiveFrom}, ${input.isSchoolDay})
    returning id
  `
  if (!rule) throw new Error('School-day routine was not saved.')
  return rule.id
}

/** Read the authenticated school's current calendar without writing audit or calendar data. */
export async function getSchoolCalendarView(
  database: DatabaseExecutor,
  input: { teacherId: string; month?: string },
): Promise<SchoolCalendarView> {
  const [scope] = await database<{
    school_id: string
    school_name: string
    time_zone: string
    class_name: string | null
    school_local_today: string
    semester_id: string | null
    academic_year: string | null
    term: 'ganjil' | 'genap' | null
    starts_on: string | null
    ends_on: string | null
  }[]>`
    select school.id as school_id, school.name as school_name, school.time_zone,
           school_class.name as class_name, school_local_today(school.id)::text as school_local_today,
           semester.id as semester_id, semester.academic_year, semester.term,
           semester.starts_on::text as starts_on, semester.ends_on::text as ends_on
    from schools as school
    left join school_classes as school_class on school_class.school_id = school.id
    left join lateral (
      select candidate.id, candidate.academic_year, candidate.term,
             candidate.starts_on, candidate.ends_on
      from semesters as candidate
      where candidate.school_id = school.id and candidate.status = 'active'
      order by candidate.starts_on, candidate.id
      limit 1
    ) as semester on true
    where school.teacher_id = ${input.teacherId}
  `

  if (!scope) {
    return {
      school: null,
      semester: null,
      schoolLocalToday: null,
      month: null,
      routineRules: [],
      days: [],
    }
  }

  if (!scope.semester_id || !scope.starts_on || !scope.ends_on || !scope.academic_year || !scope.term) {
    const selectedMonth = input.month ?? scope.school_local_today.slice(0, 7)
    return {
      school: {
        id: scope.school_id,
        name: scope.school_name,
        timeZone: scope.time_zone,
        className: scope.class_name ?? '',
      },
      semester: null,
      schoolLocalToday: scope.school_local_today,
      month: selectedMonth,
      routineRules: [],
      days: [],
    }
  }

  const monthAnchor = scope.school_local_today < scope.starts_on
    ? scope.starts_on
    : scope.school_local_today > scope.ends_on
      ? scope.ends_on
      : scope.school_local_today
  const selectedMonth = input.month ?? monthAnchor.slice(0, 7)

  const routineRules = await database<{ day_of_week: number; effective_from: string; is_school_day: boolean }[]>`
    select day_of_week, effective_from::text as effective_from, is_school_day
    from school_calendar_rules
    where school_id = ${scope.school_id} and effective_from <= ${scope.ends_on}
    order by day_of_week, effective_from
  `
  const days = await database<{
    date: string
    day_of_week: number
    routine_configured: boolean
    is_school_day: boolean
    exception_kind: CalendarExceptionKind | null
    note: string | null
    attendance_history_count: number
    effective_attendance_count: number
  }[]>`
    with period as (
      select ${selectedMonth + '-01'}::date as month_start,
             (${selectedMonth + '-01'}::date + interval '1 month - 1 day')::date as month_end
    ), calendar_days as (
      select generated.day::date as school_date
      from period
      cross join lateral generate_series(
        greatest(period.month_start, ${scope.starts_on}::date)::timestamp,
        least(period.month_end, ${scope.ends_on}::date)::timestamp,
        interval '1 day'
      ) as generated(day)
    )
    select calendar_days.school_date::text as date,
           extract(dow from calendar_days.school_date)::smallint as day_of_week,
           exists (
             select 1 from school_calendar_rules as rule
             where rule.school_id = ${scope.school_id}
               and rule.day_of_week = extract(dow from calendar_days.school_date)::smallint
               and rule.effective_from <= calendar_days.school_date
           ) as routine_configured,
           is_school_day(${scope.school_id}, calendar_days.school_date) as is_school_day,
           exception.kind as exception_kind, exception.note,
           attendance.attendance_history_count, attendance.effective_attendance_count
    from calendar_days
    left join calendar_exceptions as exception
      on exception.school_id = ${scope.school_id}
     and exception.exception_date = calendar_days.school_date
    left join lateral (
      select count(*)::int as attendance_history_count,
             count(*) filter (where record.is_effective)::int as effective_attendance_count
      from attendance_records as record
      where record.semester_id = ${scope.semester_id}
        and record.attendance_date = calendar_days.school_date
    ) as attendance on true
    order by calendar_days.school_date
  `

  return {
    school: {
      id: scope.school_id,
      name: scope.school_name,
      timeZone: scope.time_zone,
      className: scope.class_name ?? '',
    },
    semester: {
      id: scope.semester_id,
      academicYear: scope.academic_year,
      term: scope.term,
      startsOn: scope.starts_on,
      endsOn: scope.ends_on,
      status: 'active',
    },
    schoolLocalToday: scope.school_local_today,
    month: selectedMonth,
    routineRules: routineRules.map((rule) => ({
      dayOfWeek: rule.day_of_week,
      effectiveFrom: rule.effective_from,
      isSchoolDay: rule.is_school_day,
    })),
    days: days.map((day) => ({
      date: day.date,
      dayOfWeek: day.day_of_week,
      routineConfigured: day.routine_configured,
      isSchoolDay: day.is_school_day,
      exceptionKind: day.exception_kind,
      note: day.note,
      attendanceHistoryCount: day.attendance_history_count,
      effectiveAttendanceCount: day.effective_attendance_count,
    })),
  }
}

async function lockCalendarWriteScope(
  transaction: postgres.TransactionSql,
  input: { teacherId: string; date: string; lockDate: boolean },
): Promise<{ schoolId: string; semesterId: string }> {
  const [ownedSchool] = await transaction<{ school_id: string }[]>`
    select id as school_id from schools where teacher_id = ${input.teacherId}
  `
  if (!ownedSchool) {
    throw new CalendarOperationError(404, 'Data sekolah belum tersedia. Periksa pengaturan sekolah terlebih dahulu.')
  }

  // Keep the SEM close gate ahead of the calendar and date gates. The database
  // triggers use the same order, so a close and calendar write cannot deadlock.
  await lockSchoolSemesterChanges(transaction, ownedSchool.school_id)
  await transaction`select lock_school_calendar(${ownedSchool.school_id})`
  if (input.lockDate) {
    await transaction`select lock_school_calendar_date(${ownedSchool.school_id}, ${input.date}::date)`
  }

  const [semester] = await transaction<{ id: string; status: 'active' | 'closed' }[]>`
    select id, status
    from semesters
    where school_id = ${ownedSchool.school_id}
      and ${input.date}::date between starts_on and ends_on
    order by case when status = 'active' then 0 else 1 end, starts_on desc
    limit 1
    for update
  `
  if (!semester) {
    throw new CalendarOperationError(422, 'Tanggal harus berada di dalam periode semester.', {
      reason: 'date_outside_semester',
    })
  }
  if (semester.status !== 'active') {
    throw new CalendarOperationError(409, 'Semester ini sudah menjadi arsip. Kalender hanya dapat dilihat.', {
      reason: 'semester_closed',
    })
  }
  return { schoolId: ownedSchool.school_id, semesterId: semester.id }
}

export async function saveSchoolRoutine(
  database: DatabaseExecutor,
  input: { teacherId: string; effectiveFrom: string; schoolDays: number[] },
): Promise<Array<{ dayOfWeek: number; effectiveFrom: string; isSchoolDay: boolean }>> {
  return inDatabaseTransaction(database, async (transaction) => {
    const { schoolId } = await lockCalendarWriteScope(transaction, {
      teacherId: input.teacherId,
      date: input.effectiveFrom,
      lockDate: false,
    })
    const schoolDays = new Set(input.schoolDays)
    const rules = await transaction<{ day_of_week: number; effective_from: string; is_school_day: boolean }[]>`
      insert into school_calendar_rules (school_id, day_of_week, effective_from, is_school_day)
      select ${schoolId}, weekday.day_of_week, ${input.effectiveFrom}::date, weekday.day_of_week = any(${input.schoolDays}::smallint[])
      from generate_series(0, 6) as weekday(day_of_week)
      on conflict (school_id, day_of_week, effective_from)
      do update set is_school_day = excluded.is_school_day
      returning day_of_week, effective_from::text as effective_from, is_school_day
    `
    if (rules.length !== 7 || schoolDays.size !== input.schoolDays.length) {
      throw new Error('All seven calendar weekdays must be saved together.')
    }
    return rules.sort((left, right) => left.day_of_week - right.day_of_week).map((rule) => ({
      dayOfWeek: rule.day_of_week,
      effectiveFrom: rule.effective_from,
      isSchoolDay: rule.is_school_day,
    }))
  })
}

export async function saveSchoolCalendarException(
  database: DatabaseExecutor,
  input: {
    teacherId: string
    date: string
    kind: CalendarExceptionKind
    note: string | null
    previewToken?: string
  },
): Promise<{ exception: CalendarException; impact: CalendarAttendanceImpact; excludedAttendanceCount: number }> {
  return inDatabaseTransaction(database, async (transaction) => {
    const { schoolId } = await lockCalendarWriteScope(transaction, {
      teacherId: input.teacherId,
      date: input.date,
      lockDate: true,
    })
    const [currentException] = await transaction<{
      id: string
      kind: CalendarExceptionKind
      note: string | null
      updated_at: string
    }[]>`
      select id, kind, note, updated_at::text as updated_at
      from calendar_exceptions
      where school_id = ${schoolId} and exception_date = ${input.date}::date
    `
    const attendance = await transaction<{
      id: string
      status: string
      version: number
      is_effective: boolean
      semester_id: string
    }[]>`
      select record.id, record.status, record.version, record.is_effective, record.semester_id
      from attendance_records as record
      join semester_memberships as membership on membership.id = record.membership_id
      where membership.school_id = ${schoolId} and record.attendance_date = ${input.date}::date
      order by record.id
    `
    const impact: CalendarAttendanceImpact = {
      attendanceHistoryCount: attendance.length,
      effectiveAttendanceCount: attendance.filter((record) => record.is_effective).length,
    }
    const kindChanges = currentException?.kind !== input.kind
    const confirmationRequired = kindChanges && impact.attendanceHistoryCount > 0
    const previewToken = createHash('sha256').update(JSON.stringify({
      date: input.date,
      exception: currentException ?? null,
      attendance,
    })).digest('base64url')

    if (confirmationRequired && !input.previewToken) {
      throw new CalendarOperationError(409, 'Tanggal ini memiliki catatan absensi. Periksa jumlah terbaru sebelum mengubah jenis hari.', {
        reason: 'attendance_confirmation_required',
        impact,
        previewToken,
      })
    }
    if (confirmationRequired && input.previewToken !== previewToken) {
      throw new CalendarOperationError(409, 'Jumlah absensi berubah. Periksa ringkasan terbaru sebelum mengonfirmasi kembali.', {
        reason: 'preview_changed',
        impact,
        previewToken,
      })
    }

    if (input.kind === 'holiday') {
      const changed = await setCalendarHoliday(transaction, {
        schoolId,
        date: input.date,
        note: input.note,
        confirmedAttendanceImpact: confirmationRequired,
      })
      return {
        exception: changed.exception,
        impact,
        excludedAttendanceCount: changed.excludedAttendance.length,
      }
    }

    const exception = await setCalendarException(transaction, {
      schoolId,
      date: input.date,
      kind: input.kind,
      note: input.note,
      confirmedAttendanceImpact: confirmationRequired,
    })
    return { exception, impact, excludedAttendanceCount: 0 }
  })
}
