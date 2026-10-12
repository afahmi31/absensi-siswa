import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { withAuditActor } from '../../../database/audit-context.ts'
import { getDatabase } from '../../../database/client.ts'
import { closeSemester, SemesterOperationError } from '../../../database/repositories/semesters.ts'
import { readJsonRecord, requiredUuid, safeDatabaseError, validateRequestKeys } from '../../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = requiredUuid(getRouterParam(event, 'semesterId'), 'semesterId', 'Semester')
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['previewToken', 'confirmed'])

  if (body.confirmed !== true) {
    throw createError({ statusCode: 422, statusMessage: 'Konfirmasi diperlukan untuk menutup semester.' })
  }
  const previewToken = body.previewToken
  if (typeof previewToken !== 'string' || !/^[0-9a-f]{32}$/i.test(previewToken)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa kembali kelengkapan semester sebelum menutupnya.',
      data: { fieldErrors: { previewToken: 'Periksa kembali jumlah absensi sebelum menutup semester.' } },
    })
  }
  try {
    const preview = await withAuditActor(getDatabase(), teacher.id, (transaction) => closeSemester(transaction, {
      semesterId,
      teacherId: teacher.id,
      previewToken,
      confirmed: true,
    }))
    return { ok: true, preview }
  } catch (error) {
    if (error instanceof SemesterOperationError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.statusMessage, data: error.data })
    }
    safeDatabaseError(error)
  }
})
