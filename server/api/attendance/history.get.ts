import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'
import { getAttendanceHistory } from '../../database/repositories/attendance-days.ts'
import { safeAttendanceDatabaseError } from '../../utils/attendance-api.ts'
import { isIsoDate, isUuid } from '../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const query = getQuery(event)
  const semesterId = typeof query.semesterId === 'string' ? query.semesterId : ''
  const date = typeof query.date === 'string' ? query.date : ''
  if (!isUuid(semesterId)) throw createError({ statusCode: 422, statusMessage: 'Pilih semester yang benar.' })
  if (!isIsoDate(date)) throw createError({ statusCode: 422, statusMessage: 'Pilih tanggal yang benar.' })

  try {
    const history = await getAttendanceHistory(getDatabase(), { teacherId: teacher.id, semesterId, date })
    if (!history) throw createError({ statusCode: 404, statusMessage: 'Semester atau tanggal tidak ditemukan.' })
    return { history }
  } catch (error) {
    safeAttendanceDatabaseError(error)
  }
})
