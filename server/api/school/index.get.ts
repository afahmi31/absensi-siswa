import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  try {
    const database = getDatabase()
    const rows = await database<{
      principal_name: string; principal_nip: string; teacher_name: string; teacher_nip: string
      id: string
      name: string
      time_zone: string
      class_name: string | null
      active_logo_asset_id: string | null
    }[]>`
      select school.principal_name, school.principal_nip, school.teacher_name, school.teacher_nip, school.id, school.name, school.time_zone, school_class.name as class_name, school.active_logo_asset_id
      from schools as school
      left join school_classes as school_class on school_class.school_id = school.id
      where school.teacher_id = ${teacher.id}
    `
    const school = rows[0]
    return {
      school: school
        ? { principalName: school.principal_name, principalNip: school.principal_nip, teacherName: school.teacher_name, teacherNip: school.teacher_nip, id: school.id, name: school.name, timeZone: school.time_zone, className: school.class_name ?? '', logoAssetId: school.active_logo_asset_id }
        : null,
    }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Data sekolah belum dapat dimuat. Coba lagi.' })
  }
})
