import type { SemesterMembership } from './students.ts'
import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'

export type SemesterTerm = 'ganjil' | 'genap'
export type SemesterStatus = 'active' | 'closed'

export interface Semester {
  id: string
  school_id: string
  academic_year: string
  term: SemesterTerm
  starts_on: string
  ends_on: string
  status: SemesterStatus
  closed_at: Date | null
}

export interface SemesterClosurePreview {
  semester: {
    id: string
    academicYear: string
    term: SemesterTerm
    startsOn: string
    endsOn: string
    status: SemesterStatus
    schoolName: string
    className: string
  }
  calendarConfigured: boolean
  schoolDayCount: number | null
  eligibleCellCount: number | null
  filledCellCount: number | null
  blankCellCount: number | null
  incompleteSchoolDayCount: number | null
  previewToken: string
}

export class SemesterOperationError extends Error {
  readonly statusCode: number
  readonly statusMessage: string
  readonly data?: Record<string, unknown>

  constructor(
    statusCode: number,
    statusMessage: string,
    data?: Record<string, unknown>,
  ) {
    super(statusMessage)
    this.statusCode = statusCode
    this.statusMessage = statusMessage
    this.data = data
    this.name = 'SemesterOperationError'
  }
}

export async function lockSchoolSemesterChanges(database: DatabaseExecutor, schoolId: string): Promise<void> {
  await database`select pg_advisory_xact_lock(1728, hashtext(${schoolId}::text))`
}

function isConsecutiveAcademicYear(value: string): boolean {
  const match = /^(\d{4})\/(\d{4})$/.exec(value)
  if (!match) return false
  const first = Number(match[1])
  const second = Number(match[2])
  return first >= 1 && first <= 9998 && second === first + 1
}

export async function createSemester(
  database: DatabaseExecutor,
  input: { schoolId: string; academicYear: string; term: SemesterTerm; startsOn: string; endsOn: string },
): Promise<Semester> {
  if (!isConsecutiveAcademicYear(input.academicYear)) throw new Error('Academic year must use two consecutive four-digit years.')
  if (input.endsOn < input.startsOn) throw new Error('Semester end date must be on or after its start date.')

  return inDatabaseTransaction(database, async (transaction) => {
    await lockSchoolSemesterChanges(transaction, input.schoolId)
    const [semester] = await transaction<Semester[]>`
      insert into semesters (school_id, academic_year, term, starts_on, ends_on)
      values (${input.schoolId}, ${input.academicYear}, ${input.term}, ${input.startsOn}, ${input.endsOn})
      returning id, school_id, academic_year, term, starts_on::text as starts_on,
                ends_on::text as ends_on, status, closed_at
    `
    if (!semester) throw new Error('Semester was not created.')
    return semester
  })
}

export async function updateSemester(
  database: DatabaseExecutor,
  input: {
    semesterId: string
    schoolId: string
    academicYear: string
    term: SemesterTerm
    startsOn: string
    endsOn: string
  },
): Promise<Semester | null> {
  if (!isConsecutiveAcademicYear(input.academicYear)) throw new Error('Academic year must use two consecutive four-digit years.')
  if (input.endsOn < input.startsOn) throw new Error('Semester end date must be on or after its start date.')

  return inDatabaseTransaction(database, async (transaction) => {
    await lockSchoolSemesterChanges(transaction, input.schoolId)
    const [semester] = await transaction<Semester[]>`
      update semesters
      set academic_year = ${input.academicYear},
          term = ${input.term},
          starts_on = ${input.startsOn},
          ends_on = ${input.endsOn}
      where id = ${input.semesterId} and school_id = ${input.schoolId}
      returning id, school_id, academic_year, term, starts_on::text as starts_on,
                ends_on::text as ends_on, status, closed_at
    `
    return semester ?? null
  })
}

function mapClosurePreview(row: {
  semester_id: string
  academic_year: string
  term: SemesterTerm
  starts_on: string
  ends_on: string
  status: SemesterStatus
  school_name: string
  class_name: string
  calendar_configured: boolean
  school_day_count: number | null
  eligible_cell_count: number | null
  filled_cell_count: number | null
  blank_cell_count: number | null
  incomplete_school_day_count: number | null
  preview_token: string
}): SemesterClosurePreview {
  return {
    semester: {
      id: row.semester_id,
      academicYear: row.academic_year,
      term: row.term,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      status: row.status,
      schoolName: row.school_name,
      className: row.class_name,
    },
    calendarConfigured: row.calendar_configured,
    schoolDayCount: row.school_day_count,
    eligibleCellCount: row.eligible_cell_count,
    filledCellCount: row.filled_cell_count,
    blankCellCount: row.blank_cell_count,
    incompleteSchoolDayCount: row.incomplete_school_day_count,
    previewToken: row.preview_token,
  }
}

export async function getSemesterClosurePreview(
  database: DatabaseExecutor,
  input: { semesterId: string; teacherId: string },
): Promise<SemesterClosurePreview | null> {
  const [row] = await database<{
    semester_id: string
    academic_year: string
    term: SemesterTerm
    starts_on: string
    ends_on: string
    status: SemesterStatus
    school_name: string
    class_name: string
    calendar_configured: boolean
    school_day_count: number | null
    eligible_cell_count: number | null
    filled_cell_count: number | null
    blank_cell_count: number | null
    incomplete_school_day_count: number | null
    preview_token: string
  }[]>`
    with scope as (
      select semester.id as semester_id, semester.school_id,
             semester.academic_year, semester.term,
             semester.starts_on, semester.ends_on, semester.status,
             school.name as school_name, school_class.name as class_name
      from semesters as semester
      join schools as school on school.id = semester.school_id
      join school_classes as school_class on school_class.school_id = school.id
      where semester.id = ${input.semesterId} and school.teacher_id = ${input.teacherId}
    ),
    calendar_config as (
      select scope.semester_id,
        not exists (
          select 1
          from generate_series(0, 6) as weekday(day_of_week)
          where not exists (
            select 1
            from school_calendar_rules as rule
            where rule.school_id = scope.school_id
              and rule.day_of_week = weekday.day_of_week
              and rule.effective_from <= scope.starts_on
          )
        ) as configured
      from scope
    ),
    day_grid as (
      select scope.semester_id, calendar_day.day::date as school_date,
             is_school_day(scope.school_id, calendar_day.day::date) as is_school_day
      from scope
      cross join lateral generate_series(
        scope.starts_on::timestamp,
        scope.ends_on::timestamp,
        interval '1 day'
      ) as calendar_day(day)
    ),
    school_days as (
      select semester_id, school_date from day_grid where is_school_day
    ),
    eligible_cells as (
      select school_days.semester_id, school_days.school_date, membership.id as membership_id
      from school_days
      join semester_memberships as membership
        on membership.semester_id = school_days.semester_id
       and membership.starts_on <= school_days.school_date
       and (membership.ends_on is null or membership.ends_on >= school_days.school_date)
    ),
    completion as (
      select count(*)::int as eligible_cell_count,
             count(attendance.id)::int as filled_cell_count,
             (count(*) - count(attendance.id))::int as blank_cell_count,
             count(distinct eligible.school_date) filter (where attendance.id is null)::int as incomplete_school_day_count
      from eligible_cells as eligible
      left join attendance_records as attendance
        on attendance.semester_id = eligible.semester_id
       and attendance.membership_id = eligible.membership_id
       and attendance.attendance_date = eligible.school_date
       and attendance.is_effective
    ),
    school_day_total as (
      select count(*)::int as school_day_count from school_days
    ),
    state as (
      select jsonb_build_object(
        'semester', jsonb_build_array(
          scope.semester_id, scope.academic_year, scope.term,
          scope.starts_on::text, scope.ends_on::text, scope.status
        ),
        'school', jsonb_build_array(scope.school_id, scope.school_name, scope.class_name),
        'calendarRules', (
          select coalesce(jsonb_agg(
            jsonb_build_array(rule.id, rule.day_of_week, rule.effective_from::text, rule.is_school_day)
            order by rule.day_of_week, rule.effective_from, rule.id
          ), '[]'::jsonb)
          from school_calendar_rules as rule
          where rule.school_id = scope.school_id and rule.effective_from <= scope.ends_on
        ),
        'calendarExceptions', (
          select coalesce(jsonb_agg(
            jsonb_build_array(exception.id, exception.exception_date::text, exception.kind, exception.note)
            order by exception.exception_date, exception.id
          ), '[]'::jsonb)
          from calendar_exceptions as exception
          where exception.school_id = scope.school_id
            and exception.exception_date between scope.starts_on and scope.ends_on
        ),
        'memberships', (
          select coalesce(jsonb_agg(
            jsonb_build_array(
              membership.id, membership.student_id, membership.name_snapshot,
              membership.student_number_snapshot, membership.gender_snapshot,
              membership.starts_on::text, membership.ends_on::text
            ) order by membership.id
          ), '[]'::jsonb)
          from semester_memberships as membership
          where membership.semester_id = scope.semester_id
        ),
        'attendanceHistory', (
          select coalesce(jsonb_agg(
            jsonb_build_array(
              attendance.id, attendance.membership_id, attendance.attendance_date::text,
              attendance.status, attendance.version, attendance.is_effective,
              attendance.exclusion_reason, attendance.excluded_at::text,
              attendance.excluded_by_calendar_exception_id
            ) order by attendance.attendance_date, attendance.membership_id, attendance.id
          ), '[]'::jsonb)
          from attendance_records as attendance
          where attendance.semester_id = scope.semester_id
        )
      ) as payload
      from scope
    )
    select scope.semester_id, scope.academic_year, scope.term,
           scope.starts_on::text as starts_on, scope.ends_on::text as ends_on,
           scope.status, scope.school_name, scope.class_name,
           calendar_config.configured as calendar_configured,
           case when calendar_config.configured then school_day_total.school_day_count else null end as school_day_count,
           case when calendar_config.configured then completion.eligible_cell_count else null end as eligible_cell_count,
           case when calendar_config.configured then completion.filled_cell_count else null end as filled_cell_count,
           case when calendar_config.configured then completion.blank_cell_count else null end as blank_cell_count,
           case when calendar_config.configured then completion.incomplete_school_day_count else null end as incomplete_school_day_count,
           md5(state.payload::text) as preview_token
    from scope
    join calendar_config using (semester_id)
    cross join completion
    cross join school_day_total
    cross join state
  `

  return row ? mapClosurePreview(row) : null
}

export async function closeSemester(
  database: DatabaseExecutor,
  input: {
    semesterId: string
    teacherId: string
    previewToken: string
    confirmed: boolean
  },
): Promise<SemesterClosurePreview> {
  if (!input.confirmed) {
    throw new SemesterOperationError(422, 'Konfirmasi diperlukan untuk menutup semester.')
  }

  return inDatabaseTransaction(database, async (transaction) => {
    const [hint] = await transaction<{ school_id: string }[]>`
      select semester.school_id
      from semesters as semester
      join schools as school on school.id = semester.school_id
      where semester.id = ${input.semesterId} and school.teacher_id = ${input.teacherId}
    `
    if (!hint) throw new SemesterOperationError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')

    await lockSchoolSemesterChanges(transaction, hint.school_id)
    await transaction`select lock_school_calendar(${hint.school_id})`
    const [semester] = await transaction<{
      id: string
      school_id: string
      status: SemesterStatus
    }[]>`
      select semester.id, semester.school_id, semester.status
      from semesters as semester
      join schools as school on school.id = semester.school_id
      where semester.id = ${input.semesterId} and school.teacher_id = ${input.teacherId}
      for update of semester
    `
    if (!semester) throw new SemesterOperationError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')
    if (semester.status !== 'active') {
      throw new SemesterOperationError(409, 'Semester ini sudah ditutup dan tidak dapat dibuka kembali.')
    }

    const classScopes = await transaction<{ id: string }[]>`
      select school_class.id
      from schools as school
      join school_classes as school_class on school_class.school_id = school.id
      where school.id = ${semester.school_id} and school.teacher_id = ${input.teacherId}
      for share of school, school_class
    `
    if (!classScopes[0]) throw new SemesterOperationError(409, 'Data kelas belum siap. Perbarui data sekolah terlebih dahulu.')

    const currentPreview = await getSemesterClosurePreview(transaction, input)
    if (!currentPreview) throw new SemesterOperationError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')
    if (currentPreview.previewToken !== input.previewToken) {
      throw new SemesterOperationError(
        409,
        'Data berubah sejak pemeriksaan terakhir. Periksa kembali jumlah absensi sebelum menutup semester.',
        { reason: 'preview_changed', preview: currentPreview },
      )
    }

    await transaction`select set_config('app.semester_closure_confirmed', 'on', true)`
    const [closed] = await transaction<Semester[]>`
      update semesters set status = 'closed'
      where id = ${input.semesterId} and school_id = ${semester.school_id} and status = 'active'
      returning id, school_id, academic_year, term, starts_on::text as starts_on,
                ends_on::text as ends_on, status, closed_at
    `
    if (!closed) throw new SemesterOperationError(409, 'Semester sudah berubah. Muat ulang daftar semester lalu coba lagi.')

    return {
      ...currentPreview,
      semester: { ...currentPreview.semester, status: 'closed' },
    }
  })
}

/** Copy the previous closed semester's end-date roster into an empty active target semester. */
export async function copyRosterFromPreviousSemester(
  database: DatabaseExecutor,
  input: { previousSemesterId: string; targetSemesterId: string },
): Promise<SemesterMembership[]> {
  return inDatabaseTransaction(database, async (transaction) => {
    const periods = await transaction<{
      previous_school_id: string
      previous_ends_on: string
      previous_status: SemesterStatus
      target_school_id: string
      target_starts_on: string
      target_status: SemesterStatus
      target_class_id: string
      target_has_memberships: boolean
    }[]>`
      select previous.school_id as previous_school_id,
             previous.ends_on as previous_ends_on,
             previous.status as previous_status,
             target.school_id as target_school_id,
             target.starts_on as target_starts_on,
             target.status as target_status,
             school_classes.id as target_class_id,
             exists (
               select 1 from semester_memberships as existing_membership
               where existing_membership.semester_id = target.id
             ) as target_has_memberships
      from semesters as previous
      join semesters as target on target.id = ${input.targetSemesterId}
      join school_classes on school_classes.school_id = target.school_id
      where previous.id = ${input.previousSemesterId}
      for share of previous, target
    `
    const period = periods[0]
    if (!period) throw new Error('Both semesters and the target school class must exist.')
    if (period.previous_status !== 'closed') throw new Error('The previous semester must be closed before copying its roster.')
    if (period.target_status !== 'active') throw new Error('The target semester must be active.')
    if (period.target_has_memberships) throw new Error('Copy the roster only into an empty target semester.')
    if (period.previous_school_id !== period.target_school_id) throw new Error('Semester roster can only be copied within the same school.')
    if (period.previous_ends_on >= period.target_starts_on) throw new Error('The target semester must start after the previous semester ends.')

    const copied = await transaction<SemesterMembership[]>`
      insert into semester_memberships (
        semester_id, school_id, school_class_id, student_id,
        name_snapshot, student_number_snapshot, gender_snapshot, starts_on
      )
      select target.id, target.school_id, ${period.target_class_id}, old_membership.student_id,
             old_membership.name_snapshot, old_membership.student_number_snapshot,
             old_membership.gender_snapshot, target.starts_on
      from semester_memberships as old_membership
      join semesters as previous on previous.id = old_membership.semester_id
      join semesters as target on target.id = ${input.targetSemesterId}
      where previous.id = ${input.previousSemesterId}
        and old_membership.starts_on <= previous.ends_on
        and (old_membership.ends_on is null or old_membership.ends_on >= previous.ends_on)
      returning id, semester_id, school_id, school_class_id, student_id,
                name_snapshot, student_number_snapshot, gender_snapshot, starts_on::text as starts_on,
                ends_on::text as ends_on
    `
    return copied
  })
}
