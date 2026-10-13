import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { saveSchoolRoutine } from '../../database/repositories/calendar.ts'
import { isIsoDate, readJsonRecord, validateRequestKeys } from '../../utils/study-api.ts'
import { safeCalendarDatabaseError } from '../../utils/calendar-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['effectiveFrom', 'schoolDays'])

  const fieldErrors: Record<string, string> = {}
  if (!isIsoDate(body.effectiveFrom)) fieldErrors.effectiveFrom = 'Pilih tanggal yang benar.'
  if (!Array.isArray(body.schoolDays)
    || body.schoolDays.some((day) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)
    || new Set(body.schoolDays).size !== body.schoolDays.length) {
    fieldErrors.schoolDays = 'Pilih satu atau lebih hari dengan benar, atau kosongkan untuk meliburkan semua hari.'
  }
  if (Object.keys(fieldErrors).length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa kembali pilihan kalender.',
      data: { fieldErrors },
    })
  }

  try {
    const rules = await withAuditActor(getDatabase(), teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: body.effectiveFrom as string,
      schoolDays: body.schoolDays as number[],
    }))
    return { rules }
  } catch (error) {
    safeCalendarDatabaseError(error)
  }
})
