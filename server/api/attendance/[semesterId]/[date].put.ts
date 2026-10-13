import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { assertSameOrigin } from '../../../auth/same-origin.ts'
import { withAuditActor } from '../../../database/audit-context.ts'
import { getDatabase } from '../../../database/client.ts'
import { AttendanceDayError, saveAttendanceDay } from '../../../database/repositories/attendance-days.ts'
import type { AttendanceStatus } from '../../../database/repositories/attendance.ts'
import { safeAttendanceDatabaseError } from '../../../utils/attendance-api.ts'
import { isUuid, isIsoDate, readJsonRecord, validateRequestKeys } from '../../../utils/study-api.ts'

const statuses = new Set<AttendanceStatus>(['H', 'S', 'I', 'A'])

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  assertSameOrigin(event)
  const semesterId = getRouterParam(event, 'semesterId') ?? ''
  const date = getRouterParam(event, 'date') ?? ''
  if (!isUuid(semesterId)) throw createError({ statusCode: 422, statusMessage: 'Pilih semester yang benar.' })
  if (!isIsoDate(date)) throw createError({ statusCode: 422, statusMessage: 'Pilih tanggal yang benar.' })

  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['revision', 'entries'])
  if (typeof body.revision !== 'string' || body.revision.length < 32 || body.revision.length > 128) {
    throw createError({ statusCode: 422, statusMessage: 'Data absensi sudah berubah. Muat ulang sebelum menyimpan.' })
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0 || body.entries.length > 1000) {
    throw createError({ statusCode: 422, statusMessage: 'Pilih setidaknya satu siswa dan status untuk disimpan.' })
  }

  const seen = new Set<string>()
  const entries: Array<{ membershipId: string; status: AttendanceStatus | null }> = []
  for (const candidate of body.entries) {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      throw createError({ statusCode: 422, statusMessage: 'Ada pilihan siswa yang tidak valid.' })
    }
    const entry = candidate as Record<string, unknown>
    if (Object.keys(entry).some((key) => !['membershipId', 'status'].includes(key))) {
      throw createError({ statusCode: 422, statusMessage: 'Ada kolom absensi yang tidak dikenali.' })
    }
    if (!isUuid(entry.membershipId)) throw createError({ statusCode: 422, statusMessage: 'Ada siswa yang tidak valid.' })
    if (seen.has(entry.membershipId)) throw createError({ statusCode: 422, statusMessage: 'Siswa hanya boleh dicantumkan satu kali.' })
    seen.add(entry.membershipId)
    if (entry.status !== null && (typeof entry.status !== 'string' || !statuses.has(entry.status as AttendanceStatus))) {
      throw createError({ statusCode: 422, statusMessage: 'Pilih hadir, sakit, izin, alpa, atau kosongkan status.' })
    }
    entries.push({ membershipId: entry.membershipId, status: entry.status as AttendanceStatus | null })
  }

  try {
    const config = useRuntimeConfig(event)
    return await withAuditActor(getDatabase(), teacher.id, (transaction) => saveAttendanceDay(transaction, {
      teacherId: teacher.id,
      semesterId,
      date,
      revisionSecret: config.session.password,
      revision: body.revision as string,
      entries,
    }))
  } catch (error) {
    if (error instanceof AttendanceDayError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.statusMessage, data: error.data })
    }
    safeAttendanceDatabaseError(error)
  }
})
