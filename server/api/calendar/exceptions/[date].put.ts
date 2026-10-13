import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { withAuditActor } from '../../../database/audit-context.ts'
import { getDatabase } from '../../../database/client.ts'
import { saveSchoolCalendarException, type CalendarExceptionKind } from '../../../database/repositories/calendar.ts'
import { isIsoDate, optionalText, readJsonRecord, validateRequestKeys } from '../../../utils/study-api.ts'
import { safeCalendarDatabaseError } from '../../../utils/calendar-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const date = getRouterParam(event, 'date')
  if (!isIsoDate(date)) throw createError({ statusCode: 404, statusMessage: 'Tanggal kalender tidak ditemukan.' })

  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['kind', 'note', 'previewToken'])
  const fieldErrors: Record<string, string> = {}
  if (body.kind !== 'holiday' && body.kind !== 'school_day') {
    fieldErrors.kind = 'Pilih hari libur atau hari sekolah khusus.'
  }
  if (body.previewToken !== undefined
    && (typeof body.previewToken !== 'string' || body.previewToken.length > 128)) {
    fieldErrors.previewToken = 'Konfirmasi kalender sudah tidak berlaku. Periksa kembali jumlah absensi.'
  }
  if (Object.keys(fieldErrors).length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa kembali perubahan tanggal.',
      data: { fieldErrors },
    })
  }
  const note = optionalText(body.note, 'note', 'Catatan', 240)

  try {
    const result = await withAuditActor(getDatabase(), teacher.id, (transaction) => saveSchoolCalendarException(transaction, {
      teacherId: teacher.id,
      date,
      kind: body.kind as CalendarExceptionKind,
      note,
      previewToken: body.previewToken as string | undefined,
    }))
    return result
  } catch (error) {
    safeCalendarDatabaseError(error)
  }
})
