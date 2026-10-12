import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  try {
    const database = getDatabase()
    const semesters = await database<{
      id: string
      academic_year: string
      term: 'ganjil' | 'genap'
      starts_on: string
      ends_on: string
      status: 'active' | 'closed'
    }[]>`
      select semester.id, semester.academic_year, semester.term,
             semester.starts_on::text as starts_on, semester.ends_on::text as ends_on,
             semester.status
      from semesters as semester
      join schools as school on school.id = semester.school_id
      where school.teacher_id = ${teacher.id}
      order by semester.starts_on desc, semester.created_at desc
    `
    return {
      semesters: semesters.map((semester) => ({
        id: semester.id,
        academicYear: semester.academic_year,
        term: semester.term,
        startsOn: semester.starts_on,
        endsOn: semester.ends_on,
        status: semester.status,
      })),
    }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Daftar semester belum dapat dimuat. Coba lagi.' })
  }
})
