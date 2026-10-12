import type postgres from 'postgres'
import type { AttendanceRecord } from './attendance.ts'
import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'

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
