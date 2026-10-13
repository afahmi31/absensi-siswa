import { createHmac, timingSafeEqual } from 'node:crypto'
import type postgres from 'postgres'
import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'
import { lockSchoolSemesterChanges } from './semesters.ts'
import type { AttendanceStatus } from './attendance.ts'

export type AttendanceReadOnlyReason =
  | 'semester_closed'
  | 'future_date'
  | 'calendar_holiday'
  | 'calendar_unset'
  | 'not_school_day'

interface MembershipSnapshot {
  id: string
  name: string
  studentNumber: string | null
  gender: 'L' | 'P' | null
  startsOn: string
  endsOn: string | null
  updatedAt: string
}

interface AttendanceSnapshot {
  id: string
  membershipId: string
  status: AttendanceStatus | null
  version: number
  isEffective: boolean
  exclusionReason: string | null
  excludedAt: string | null
  excludedByCalendarExceptionId: string | null
  recordedAt: string
  updatedAt: string
}

interface RawAttendanceDay {
  school_id: string
  school_name: string
  time_zone: string
  school_updated_at: string
  school_local_today: string
  class_id: string | null
  class_name: string | null
  class_created_at: string | null
  class_latest_audit_id: string | null
  class_latest_audit_at: string | null
  semester_id: string
  academic_year: string
  term: 'ganjil' | 'genap'
  starts_on: string
  ends_on: string
  semester_status: 'active' | 'closed'
  semester_updated_at: string
  membership_state: MembershipSnapshot[]
  routine_state: {
    id: string
    dayOfWeek: number
    effectiveFrom: string
    isSchoolDay: boolean
    latestAuditId: string | null
    latestAuditAt: string | null
  } | null
  exception_state: {
    id: string
    kind: 'holiday' | 'school_day'
    note: string | null
    updatedAt: string
  } | null
  attendance_state: AttendanceSnapshot[]
  audit_state: Array<{
    id: string
    entityId: string
    actorTeacherId: string | null
    actorKind: 'teacher' | 'system'
    eventType: 'insert' | 'update' | 'delete'
    occurredAt: string
    oldValue: unknown
    newValue: unknown
  }>
}

export interface AttendanceDayView {
  school: { id: string; name: string; timeZone: string; className: string } | null
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active' | 'closed'
  } | null
  schoolLocalToday: string | null
  date: string
  dayOfWeek: number | null
  routineConfigured: boolean
  isSchoolDay: boolean
  exceptionKind: 'holiday' | 'school_day' | null
  note: string | null
  roster: Array<MembershipSnapshot & { status: AttendanceStatus | null }>
  unfilledCount: number
  historyCount: number
  readOnlyReason: AttendanceReadOnlyReason | null
  revision: string
}

export class AttendanceDayError extends Error {
  readonly statusCode: number
  readonly statusMessage: string
  readonly data?: Record<string, unknown>

  constructor(statusCode: number, statusMessage: string, data?: Record<string, unknown>) {
    super(statusMessage)
    this.statusCode = statusCode
    this.statusMessage = statusMessage
    this.data = data
    this.name = 'AttendanceDayError'
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function revisionFor(secret: string, teacherId: string, semesterId: string, date: string, state: RawAttendanceDay): string {
  if (secret.length < 32) throw new AttendanceDayError(503, 'Layanan absensi belum siap. Periksa konfigurasi sesi terlebih dahulu.')
  return createHmac('sha256', secret)
    .update('LAB002-ATT-001-day-revision-v1\0')
    .update(stableJson({ teacherId, semesterId, date, state }))
    .digest('base64url')
}

function sameRevision(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'ascii')
  const rightBytes = Buffer.from(right, 'ascii')
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

async function readRawAttendanceDay(
  database: DatabaseExecutor,
  input: { teacherId: string; semesterId: string; date: string },
): Promise<RawAttendanceDay | null> {
  const [row] = await database<RawAttendanceDay[]>`
    with scope as (
      select school.id as school_id, school.name as school_name, school.time_zone,
             school.updated_at::text as school_updated_at,
             school_local_today(school.id)::text as school_local_today,
             school_class.id as class_id, school_class.name as class_name,
             school_class.created_at::text as class_created_at,
             (
               select audit.id::text
               from audit_events as audit
               where audit.entity_type = 'school_classes' and audit.entity_id = school_class.id
               order by audit.id desc
               limit 1
             ) as class_latest_audit_id,
             (
               select audit.occurred_at::text
               from audit_events as audit
               where audit.entity_type = 'school_classes' and audit.entity_id = school_class.id
               order by audit.id desc
               limit 1
             ) as class_latest_audit_at,
             semester.id as semester_id, semester.academic_year, semester.term,
             semester.starts_on::text as starts_on, semester.ends_on::text as ends_on,
             semester.status as semester_status,
             semester.updated_at::text as semester_updated_at
      from schools as school
      join semesters as semester on semester.school_id = school.id
      left join school_classes as school_class on school_class.school_id = school.id
      where school.teacher_id = ${input.teacherId}
        and semester.id = ${input.semesterId}
    ), day_rule as (
      select rule.id, extract(dow from ${input.date}::date)::int as day_of_week,
             rule.effective_from::text as effective_from, rule.is_school_day,
             (
               select audit.id::text
               from audit_events as audit
               where audit.entity_type = 'school_calendar_rules' and audit.entity_id = rule.id
               order by audit.id desc
               limit 1
             ) as latest_audit_id,
             (
               select audit.occurred_at::text
               from audit_events as audit
               where audit.entity_type = 'school_calendar_rules' and audit.entity_id = rule.id
               order by audit.id desc
               limit 1
             ) as latest_audit_at
      from scope
      join school_calendar_rules as rule on rule.school_id = scope.school_id
      where rule.day_of_week = extract(dow from ${input.date}::date)::smallint
        and rule.effective_from <= ${input.date}::date
      order by rule.effective_from desc
      limit 1
    )
    select scope.school_id, scope.school_name, scope.time_zone, scope.school_updated_at,
           scope.school_local_today, scope.class_id, scope.class_name, scope.class_created_at,
           scope.class_latest_audit_id, scope.class_latest_audit_at,
           scope.semester_id, scope.academic_year, scope.term, scope.starts_on, scope.ends_on,
           scope.semester_status, scope.semester_updated_at,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', membership.id,
               'name', membership.name_snapshot,
               'studentNumber', membership.student_number_snapshot,
               'gender', membership.gender_snapshot,
               'startsOn', membership.starts_on::text,
               'endsOn', membership.ends_on::text,
               'updatedAt', membership.updated_at::text
             ) order by membership.name_snapshot, membership.id)
             from semester_memberships as membership
             where membership.semester_id = scope.semester_id
               and membership.starts_on <= ${input.date}::date
               and (membership.ends_on is null or membership.ends_on >= ${input.date}::date)
           ), '[]'::jsonb) as membership_state,
           (select jsonb_build_object(
             'id', day_rule.id,
             'dayOfWeek', day_rule.day_of_week,
             'effectiveFrom', day_rule.effective_from,
             'isSchoolDay', day_rule.is_school_day,
             'latestAuditId', day_rule.latest_audit_id,
             'latestAuditAt', day_rule.latest_audit_at
           ) from day_rule) as routine_state,
           (select jsonb_build_object(
             'id', exception.id,
             'kind', exception.kind,
             'note', exception.note,
             'updatedAt', exception.updated_at::text
           )
            from calendar_exceptions as exception
            where exception.school_id = scope.school_id
              and exception.exception_date = ${input.date}::date) as exception_state,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', record.id,
               'membershipId', record.membership_id,
               'status', record.status,
               'version', record.version,
               'isEffective', record.is_effective,
               'exclusionReason', record.exclusion_reason,
               'excludedAt', record.excluded_at::text,
               'excludedByCalendarExceptionId', record.excluded_by_calendar_exception_id,
               'recordedAt', record.recorded_at::text,
               'updatedAt', record.updated_at::text
             ) order by record.membership_id, record.recorded_at, record.id)
             from attendance_records as record
             where record.semester_id = scope.semester_id
               and record.attendance_date = ${input.date}::date
           ), '[]'::jsonb) as attendance_state,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id', audit.id::text,
               'entityId', audit.entity_id,
               'actorTeacherId', audit.actor_teacher_id,
               'actorKind', audit.actor_kind,
               'eventType', audit.event_type,
               'occurredAt', audit.occurred_at::text,
               'oldValue', audit.old_value,
               'newValue', audit.new_value
             ) order by audit.id)
             from audit_events as audit
             join attendance_records as record on record.id = audit.entity_id
             where audit.entity_type = 'attendance_records'
               and record.semester_id = scope.semester_id
               and record.attendance_date = ${input.date}::date
           ), '[]'::jsonb) as audit_state
    from scope
  `
  return row ?? null
}

function buildAttendanceDayView(
  raw: RawAttendanceDay,
  input: { teacherId: string; semesterId: string; date: string; revisionSecret: string },
): AttendanceDayView {
  if (input.date < raw.starts_on || input.date > raw.ends_on) {
    throw new AttendanceDayError(422, 'Tanggal absensi harus berada di dalam periode semester.', { reason: 'date_outside_semester' })
  }

  const dayOfWeek = new Date(`${input.date}T00:00:00Z`).getUTCDay()
  const exception = raw.exception_state
  const routine = raw.routine_state
  const isSchoolDay = exception
    ? exception.kind === 'school_day'
    : routine?.isSchoolDay ?? false
  const currentByMembership = new Map<string, AttendanceSnapshot>()
  for (const record of raw.attendance_state) {
    if (record.isEffective) currentByMembership.set(record.membershipId, record)
  }
  const roster = raw.membership_state.map((membership) => ({
    ...membership,
    status: currentByMembership.get(membership.id)?.status ?? null,
  }))
  const readOnlyReason: AttendanceReadOnlyReason | null = raw.semester_status === 'closed'
    ? 'semester_closed'
    : input.date > raw.school_local_today
      ? 'future_date'
      : exception?.kind === 'holiday'
        ? 'calendar_holiday'
        : !routine && !exception
          ? 'calendar_unset'
          : !isSchoolDay
            ? 'not_school_day'
            : null

  return {
    school: {
      id: raw.school_id,
      name: raw.school_name,
      timeZone: raw.time_zone,
      className: raw.class_name ?? '',
    },
    semester: {
      id: raw.semester_id,
      academicYear: raw.academic_year,
      term: raw.term,
      startsOn: raw.starts_on,
      endsOn: raw.ends_on,
      status: raw.semester_status,
    },
    schoolLocalToday: raw.school_local_today,
    date: input.date,
    dayOfWeek,
    routineConfigured: routine !== null,
    isSchoolDay,
    exceptionKind: exception?.kind ?? null,
    note: exception?.note ?? null,
    roster,
    unfilledCount: roster.filter((membership) => !membership.status).length,
    historyCount: raw.attendance_state.length,
    readOnlyReason,
    revision: revisionFor(input.revisionSecret, input.teacherId, input.semesterId, input.date, raw),
  }
}

export async function getAttendanceDayView(
  database: DatabaseExecutor,
  input: { teacherId: string; semesterId: string; date: string; revisionSecret: string },
): Promise<AttendanceDayView | null> {
  const raw = await readRawAttendanceDay(database, input)
  return raw ? buildAttendanceDayView(raw, input) : null
}

export async function saveAttendanceDay(
  database: DatabaseExecutor,
  input: {
    teacherId: string
    semesterId: string
    date: string
    revisionSecret: string
    revision: string
    entries: Array<{ membershipId: string; status: AttendanceStatus | null }>
  },
): Promise<AttendanceDayView> {
  return inDatabaseTransaction(database, async (transaction) => {
    const [ownedScope] = await transaction<{ school_id: string }[]>`
      select school.id as school_id
      from schools as school
      join semesters as semester on semester.school_id = school.id
      where school.teacher_id = ${input.teacherId} and semester.id = ${input.semesterId}
    `
    if (!ownedScope) throw new AttendanceDayError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')

    await lockSchoolSemesterChanges(transaction, ownedScope.school_id)
    await transaction`select lock_school_calendar(${ownedScope.school_id})`
    await transaction`select lock_school_calendar_date(${ownedScope.school_id}, ${input.date}::date)`

    const [scope] = await transaction<{ id: string }[]>`
      select semester.id
      from schools as school
      join school_classes as school_class on school_class.school_id = school.id
      join semesters as semester on semester.school_id = school.id
      where school.id = ${ownedScope.school_id}
        and school.teacher_id = ${input.teacherId}
        and semester.id = ${input.semesterId}
      for share of school, school_class, semester
    `
    if (!scope) throw new AttendanceDayError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')

    await transaction`
      select membership.id
      from semester_memberships as membership
      where membership.semester_id = ${input.semesterId}
      order by membership.id
      for update
    `
    await transaction`
      select record.id
      from attendance_records as record
      where record.semester_id = ${input.semesterId}
        and record.attendance_date = ${input.date}::date
      order by record.membership_id, record.recorded_at, record.id
      for update
    `

    const current = await getAttendanceDayView(transaction, input)
    if (!current) throw new AttendanceDayError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')
    if (!sameRevision(current.revision, input.revision)) {
      throw new AttendanceDayError(409, 'Data daftar siswa, kalender, atau absensi berubah. Muat ulang setelah memutuskan untuk membuang perubahan yang belum disimpan.', {
        reason: 'stale_day',
      })
    }
    if (current.readOnlyReason) {
      throw new AttendanceDayError(409, 'Tanggal ini hanya dapat dilihat dan tidak menerima perubahan absensi.', {
        reason: current.readOnlyReason,
      })
    }
    if (input.entries.length === 0) throw new AttendanceDayError(422, 'Pilih setidaknya satu status sebelum menyimpan.')

    const eligibleIds = new Set(current.roster.map((membership) => membership.id))
    for (const entry of input.entries) {
      if (!eligibleIds.has(entry.membershipId)) {
        throw new AttendanceDayError(422, 'Ada siswa yang tidak memenuhi syarat untuk tanggal ini.', { reason: 'ineligible_membership' })
      }
      if (entry.status !== null && !['H', 'S', 'I', 'A'].includes(entry.status)) {
        throw new AttendanceDayError(422, 'Pilih hadir, sakit, izin, alpa, atau kosongkan status.')
      }
    }

    const existing = await transaction<AttendanceSnapshot[]>`
      select id, membership_id as "membershipId", status, version, is_effective as "isEffective",
             exclusion_reason as "exclusionReason", excluded_at::text as "excludedAt",
             excluded_by_calendar_exception_id as "excludedByCalendarExceptionId",
             recorded_at::text as "recordedAt", updated_at::text as "updatedAt"
      from attendance_records
      where semester_id = ${input.semesterId} and attendance_date = ${input.date}::date
      order by membership_id, recorded_at, id
    `
    const effectiveByMembership = new Map(existing.filter((row) => row.isEffective).map((row) => [row.membershipId, row]))
    const hasClear = input.entries.some((entry) => entry.status === null && effectiveByMembership.has(entry.membershipId))
    if (hasClear) await transaction`select set_config('app.attendance_clear_confirmed', 'on', true)`

    for (const entry of input.entries) {
      const old = effectiveByMembership.get(entry.membershipId)
      if (entry.status === null) {
        if (old) {
          await transaction`
            update attendance_records
            set status = null,
                version = version + 1,
                is_effective = false,
                exclusion_reason = 'manual_clear',
                excluded_at = clock_timestamp(),
                excluded_by_calendar_exception_id = null
            where id = ${old.id}
          `
        }
      } else if (old) {
        if (old.status !== entry.status) {
          await transaction`
            update attendance_records
            set status = ${entry.status}::attendance_status, version = version + 1
            where id = ${old.id}
          `
        }
      } else {
        await transaction`
          insert into attendance_records (membership_id, semester_id, attendance_date, status)
          values (${entry.membershipId}, ${input.semesterId}, ${input.date}::date, ${entry.status}::attendance_status)
        `
      }
    }

    const saved = await getAttendanceDayView(transaction, input)
    if (!saved) throw new AttendanceDayError(503, 'Absensi belum dapat dimuat setelah disimpan.')
    return saved
  })
}

export interface AttendanceHistoryItem {
  id: string
  date: string
  studentName: string
  studentNumber: string | null
  statusBefore: AttendanceStatus | null
  statusAfter: AttendanceStatus | null
  actorTeacherId: string | null
  actorKind: 'teacher' | 'system'
  occurredAt: string
  isEffective: boolean
  exclusionReason: string | null
}

export async function getAttendanceHistory(
  database: DatabaseExecutor,
  input: { teacherId: string; semesterId: string; date: string },
): Promise<AttendanceHistoryItem[] | null> {
  const [owned] = await database<{ id: string }[]>`
    select semester.id
    from semesters as semester
    join schools as school on school.id = semester.school_id
    where semester.id = ${input.semesterId} and school.teacher_id = ${input.teacherId}
      and ${input.date}::date between semester.starts_on and semester.ends_on
  `
  if (!owned) return null

  const rows = await database<Array<{
    id: string
    date: string
    student_name: string
    student_number: string | null
    status_before: AttendanceStatus | null
    status_after: AttendanceStatus | null
    actor_teacher_id: string | null
    actor_kind: 'teacher' | 'system'
    occurred_at: string
    is_effective: boolean
    exclusion_reason: string | null
  }>>`
    select audit.id::text as id,
           record.attendance_date::text as date,
           membership.name_snapshot as student_name,
           membership.student_number_snapshot as student_number,
           audit.old_value ->> 'status' as status_before,
           audit.new_value ->> 'status' as status_after,
           audit.actor_teacher_id::text as actor_teacher_id,
           audit.actor_kind,
           audit.occurred_at::text as occurred_at,
           coalesce((audit.new_value ->> 'is_effective')::boolean, false) as is_effective,
           audit.new_value ->> 'exclusion_reason' as exclusion_reason
    from audit_events as audit
    join attendance_records as record on record.id = audit.entity_id
    join semester_memberships as membership on membership.id = record.membership_id
    where audit.entity_type = 'attendance_records'
      and record.semester_id = ${input.semesterId}
      and record.attendance_date = ${input.date}::date
    order by audit.occurred_at desc, audit.id desc
  `

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    studentName: row.student_name,
    studentNumber: row.student_number,
    statusBefore: row.status_before,
    statusAfter: row.status_after,
    actorTeacherId: row.actor_teacher_id,
    actorKind: row.actor_kind,
    occurredAt: row.occurred_at,
    isEffective: row.is_effective,
    exclusionReason: row.exclusion_reason,
  }))
}
