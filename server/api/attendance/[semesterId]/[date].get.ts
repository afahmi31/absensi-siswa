import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { getAttendanceDayView } from '../../../database/repositories/attendance-days.ts'
import { safeAttendanceDatabaseError } from '../../../utils/attendance-api.ts'
import { isIsoDate, isUuid } from '../../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = getRouterParam(event, 'semesterId') ?? ''
  const date = getRouterParam(event, 'date') ?? ''
  if (!isUuid(semesterId)) throw createError({ statusCode: 422, statusMessage: 'Pilih semester yang benar.' })
  if (!isIsoDate(date)) throw createError({ statusCode: 422, statusMessage: 'Pilih tanggal yang benar.' })

  try {
    const config = useRuntimeConfig(event)
    const day = await getAttendanceDayView(getDatabase(), {
      teacherId: teacher.id,
      semesterId,
      date,
      revisionSecret: config.session.password,
    })
    if (!day) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })
    return day
  } catch (error) {
    safeAttendanceDatabaseError(error)
  }
})
