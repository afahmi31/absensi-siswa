import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'
import { getSchoolCalendarView } from '../../database/repositories/calendar.ts'
import { isIsoDate } from '../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const query = getQuery(event)
  const monthValue = typeof query.month === 'string' ? query.month : undefined
  if (monthValue !== undefined && !isIsoDate(`${monthValue}-01`)) {
    throw createError({ statusCode: 422, statusMessage: 'Pilih bulan kalender yang benar.' })
  }

  try {
    return await getSchoolCalendarView(getDatabase(), { teacherId: teacher.id, month: monthValue })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Kalender belum dapat dimuat. Coba lagi.' })
  }
})
