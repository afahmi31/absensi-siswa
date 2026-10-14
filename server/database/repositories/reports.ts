import type { DatabaseExecutor } from '../transaction.ts'
import type { AttendanceStatus } from './attendance.ts'

export type AttendanceReportMode = 'month' | 'semester'

export interface AttendanceReportDay {
  day: number
  date: string | null
  inSemester: boolean
  isSchoolDay: boolean
}

export interface AttendanceReportRow {
  membershipId: string
  name: string
  studentNumber: string | null
  gender: 'L' | 'P' | null
  cells: Array<AttendanceStatus | null>
  totals: Record<AttendanceStatus, number>
}

export interface AttendanceReportMonth {
  month: string
  days: AttendanceReportDay[]
  rows: AttendanceReportRow[]
}

export interface AttendanceReport {
  mode: AttendanceReportMode
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active' | 'closed'
    schoolName: string
    className: string
  }
  months: AttendanceReportMonth[]
}

export type AttendanceReportResult =
  | { kind: 'not_found' }
  | { kind: 'month_outside_semester' }
  | { kind: 'report'; report: AttendanceReport }

interface ReportQueryRow {
  semester_id: string
  academic_year: string
  term: 'ganjil' | 'genap'
  starts_on: string
  ends_on: string
  status: 'active' | 'closed'
  school_name: string
  class_name: string
  month_start: string | null
  calendar_days: unknown
  membership_id: string | null
  membership_name: string | null
  student_number: string | null
  gender: 'L' | 'P' | null
  cells: unknown
  total_h: number | null
  total_s: number | null
  total_i: number | null
  total_a: number | null
}

/**
 * Reads one report from one PostgreSQL statement. All CTEs share the statement's
 * MVCC snapshot, and the result is set-based across months, memberships and days.
 */
export async function getAttendanceReport(
  database: DatabaseExecutor,
  input: { teacherId: string; semesterId: string; mode: AttendanceReportMode; month?: string },
): Promise<AttendanceReportResult> {
  const monthStart = input.month ? `${input.month}-01` : null
  const result = await database<ReportQueryRow[]>`
    with scope_base as (
      select semester.id as semester_id,
             coalesce(archive.academic_year, semester.academic_year) as academic_year,
             coalesce(archive.term, semester.term) as term,
             coalesce(archive.starts_on, semester.starts_on)::text as starts_on,
             coalesce(archive.ends_on, semester.ends_on)::text as ends_on,
             semester.status,
             coalesce(archive.school_name, school.name) as school_name,
             archive.class_name as archive_class_name,
             semester.school_id,
             coalesce(archive.starts_on, semester.starts_on) as semester_start,
             coalesce(archive.ends_on, semester.ends_on) as semester_end
      from semesters as semester
      join schools as school on school.id = semester.school_id
      left join semester_archive_snapshots as archive on archive.semester_id = semester.id
      where semester.id = ${input.semesterId}
        and school.teacher_id = ${input.teacherId}
    ),
    class_names as (
      select scope_base.semester_id,
             coalesce(
               (
                 select string_agg(roster_class.name, ', ' order by roster_class.name)
                 from (
                   select distinct classes.name
                   from semester_memberships as membership
                   join school_classes as classes on classes.id = membership.school_class_id
                   where membership.semester_id = scope_base.semester_id
                 ) as roster_class
               ),
               (
                 select string_agg(school_class.name, ', ' order by school_class.name)
                 from school_classes as school_class
                 where school_class.school_id = scope_base.school_id
               ),
               ''
             ) as class_name
      from scope_base
    ),
    scope as (
      select scope_base.*, coalesce(scope_base.archive_class_name, class_names.class_name, '') as class_name
      from scope_base
      join class_names using (semester_id)
    ),
    requested_months as (
      select generated.month_start::date as month_start
      from scope
      cross join lateral generate_series(
        date_trunc('month', scope.semester_start)::timestamp,
        date_trunc('month', scope.semester_end)::timestamp,
        interval '1 month'
      ) as generated(month_start)
      where ${input.mode} = 'semester'
      union all
      select ${monthStart}::date as month_start
      where ${input.mode} = 'month'
    ),
    report_months as (
      select scope.semester_id, requested.month_start,
             (requested.month_start + interval '1 month - 1 day')::date as month_end,
             greatest(requested.month_start, scope.semester_start) as period_start,
             least((requested.month_start + interval '1 month - 1 day')::date, scope.semester_end) as period_end
      from scope
      join requested_months as requested on true
      where requested.month_start <= date_trunc('month', scope.semester_end)::date
        and (requested.month_start + interval '1 month - 1 day')::date >= scope.semester_start
    ),
    day_grid as (
      select month.month_start, day_numbers.day_number,
             (month.month_start + (day_numbers.day_number - 1))::date as school_date,
             day_numbers.day_number <= extract(day from month.month_end)::integer as is_actual_date,
             (month.month_start + (day_numbers.day_number - 1))::date between scope.semester_start and scope.semester_end
               and day_numbers.day_number <= extract(day from month.month_end)::integer as in_semester,
             case
               when day_numbers.day_number <= extract(day from month.month_end)::integer
                 and (month.month_start + (day_numbers.day_number - 1))::date between scope.semester_start and scope.semester_end
               then is_school_day(scope.school_id, (month.month_start + (day_numbers.day_number - 1))::date)
               else false
             end as is_school_day
      from report_months as month
      join scope on scope.semester_id = month.semester_id
      cross join generate_series(1, 31) as day_numbers(day_number)
    ),
    calendar_days as (
      select day_grid.month_start,
             jsonb_agg(jsonb_build_object(
               'day', day_grid.day_number,
               'date', case when day_grid.is_actual_date then day_grid.school_date::text else null end,
               'inSemester', day_grid.in_semester,
               'isSchoolDay', day_grid.is_school_day
             ) order by day_grid.day_number) as days
      from day_grid
      group by day_grid.month_start
    ),
    report_memberships as (
      select month.month_start, membership.id as membership_id,
             membership.name_snapshot as membership_name,
             membership.student_number_snapshot as student_number,
             membership.gender_snapshot as gender,
             membership.starts_on, membership.ends_on
      from report_months as month
      join semester_memberships as membership
        on membership.semester_id = month.semester_id
       and membership.starts_on <= month.period_end
       and (membership.ends_on is null or membership.ends_on >= month.period_start)
    ),
    member_cells as (
      select membership.month_start, membership.membership_id,
             jsonb_agg(attendance.status::text order by day_grid.day_number) as cells,
             count(*) filter (where attendance.status = 'H')::int as total_h,
             count(*) filter (where attendance.status = 'S')::int as total_s,
             count(*) filter (where attendance.status = 'I')::int as total_i,
             count(*) filter (where attendance.status = 'A')::int as total_a
      from report_memberships as membership
      join day_grid on day_grid.month_start = membership.month_start
      left join effective_attendance as attendance
        on attendance.semester_id = ${input.semesterId}
       and attendance.membership_id = membership.membership_id
       and attendance.attendance_date = day_grid.school_date
       and day_grid.is_actual_date
       and day_grid.in_semester
       and day_grid.is_school_day
       and day_grid.school_date between membership.starts_on and coalesce(membership.ends_on, 'infinity'::date)
      group by membership.month_start, membership.membership_id
    )
    select scope.semester_id,
           scope.academic_year,
           scope.term,
           scope.starts_on,
           scope.ends_on,
           scope.status,
           scope.school_name,
           scope.class_name,
           report_months.month_start::text as month_start,
           calendar_days.days as calendar_days,
           report_memberships.membership_id,
           report_memberships.membership_name,
           report_memberships.student_number,
           report_memberships.gender,
           member_cells.cells,
           member_cells.total_h,
           member_cells.total_s,
           member_cells.total_i,
           member_cells.total_a
    from scope
    left join report_months on true
    left join calendar_days on calendar_days.month_start = report_months.month_start
    left join report_memberships on report_memberships.month_start = report_months.month_start
    left join member_cells
      on member_cells.month_start = report_memberships.month_start
     and member_cells.membership_id = report_memberships.membership_id
    order by report_months.month_start, report_memberships.membership_name, report_memberships.membership_id
  `

  const first = result[0]
  if (!first) return { kind: 'not_found' }
  if (input.mode === 'month' && !first.month_start) return { kind: 'month_outside_semester' }

  const monthsByKey = new Map<string, AttendanceReportMonth>()
  for (const row of result) {
    if (!row.month_start) continue
    let month = monthsByKey.get(row.month_start)
    if (!month) {
      month = {
        month: row.month_start.slice(0, 7),
        days: row.calendar_days as AttendanceReportDay[],
        rows: [],
      }
      monthsByKey.set(row.month_start, month)
    }
    if (!row.membership_id) continue
    month.rows.push({
      membershipId: row.membership_id,
      name: row.membership_name ?? '',
      studentNumber: row.student_number,
      gender: row.gender,
      cells: row.cells as Array<AttendanceStatus | null>,
      totals: {
        H: Number(row.total_h ?? 0),
        S: Number(row.total_s ?? 0),
        I: Number(row.total_i ?? 0),
        A: Number(row.total_a ?? 0),
      },
    })
  }

  return {
    kind: 'report',
    report: {
      mode: input.mode,
      semester: {
        id: first.semester_id,
        academicYear: first.academic_year,
        term: first.term,
        startsOn: first.starts_on,
        endsOn: first.ends_on,
        status: first.status,
        schoolName: first.school_name,
        className: first.class_name,
      },
      months: [...monthsByKey.values()],
    },
  }
}
