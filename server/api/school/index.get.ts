import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  try {
    const database = getDatabase()
    const rows = await database<{
      id: string
      name: string
      time_zone: string
      class_name: string | null
    }[]>`
      select school.id, school.name, school.time_zone, school_class.name as class_name
      from schools as school
      left join school_classes as school_class on school_class.school_id = school.id
      where school.teacher_id = ${teacher.id}
    `
    const school = rows[0]
    return {
      school: school
        ? { id: school.id, name: school.name, timeZone: school.time_zone, className: school.class_name ?? '' }
        : null,
    }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Data sekolah belum dapat dimuat. Coba lagi.' })
  }
})
