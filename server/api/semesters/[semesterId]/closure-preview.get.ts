import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { getSemesterClosurePreview } from '../../../database/repositories/semesters.ts'
import { requiredUuid } from '../../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = requiredUuid(getRouterParam(event, 'semesterId'), 'semesterId', 'Semester')

  try {
    const preview = await getSemesterClosurePreview(getDatabase(), { semesterId, teacherId: teacher.id })
    if (!preview) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })
    if (preview.semester.status !== 'active') throw createError({ statusCode: 409, statusMessage: 'Semester ini sudah ditutup.' })
    return { preview }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Kelengkapan semester belum dapat diperiksa. Coba lagi.' })
  }
})
