import type { DatabaseExecutor } from '../transaction.ts'

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'

export interface AttendanceRecord {
  id: string
  membership_id: string
  semester_id: string
  attendance_date: string
  status: AttendanceStatus
  version: number
  is_effective: boolean
}

export async function recordAttendance(
  database: DatabaseExecutor,
  input: { membershipId: string; semesterId: string; date: string; status: AttendanceStatus },
): Promise<AttendanceRecord> {
  const [record] = await database<AttendanceRecord[]>`
    insert into attendance_records (membership_id, semester_id, attendance_date, status)
    values (${input.membershipId}, ${input.semesterId}, ${input.date}, ${input.status})
    returning id, membership_id, semester_id, attendance_date, status, version, is_effective
  `
  if (!record) throw new Error('Attendance was not created.')
  return record
}

export async function correctAttendance(
  database: DatabaseExecutor,
  input: { attendanceId: string; expectedVersion: number; status: AttendanceStatus },
): Promise<AttendanceRecord> {
  const [record] = await database<AttendanceRecord[]>`
    update attendance_records
    set status = ${input.status}, version = version + 1
    where id = ${input.attendanceId} and version = ${input.expectedVersion} and is_effective
    returning id, membership_id, semester_id, attendance_date, status, version, is_effective
  `
  if (!record) throw new Error('Attendance was changed or is no longer effective; reload before correcting it.')
  return record
}

export async function listEffectiveAttendance(
  database: DatabaseExecutor,
  input: { semesterId: string; from: string; through: string },
): Promise<AttendanceRecord[]> {
  return database<AttendanceRecord[]>`
    select id, membership_id, semester_id, attendance_date, status, version, true as is_effective
    from effective_attendance
    where semester_id = ${input.semesterId}
      and attendance_date between ${input.from} and ${input.through}
    order by attendance_date, membership_id
  `
}
