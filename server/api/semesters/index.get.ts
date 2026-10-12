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
      school_name: string
      class_name: string
      students_at_end: number
    }[]>`
      select semester.id,
             coalesce(snapshot.academic_year, semester.academic_year) as academic_year,
             coalesce(snapshot.term, semester.term) as term,
             coalesce(snapshot.starts_on, semester.starts_on)::text as starts_on,
             coalesce(snapshot.ends_on, semester.ends_on)::text as ends_on,
             semester.status,
             coalesce(snapshot.school_name, school.name, '') as school_name,
             coalesce(snapshot.class_name, school_class.name, '') as class_name,
             (
               select count(*)::int
               from semester_memberships as membership
               where membership.semester_id = semester.id
                 and membership.starts_on <= semester.ends_on
                 and (membership.ends_on is null or membership.ends_on >= semester.ends_on)
             ) as students_at_end
      from semesters as semester
      join schools as school on school.id = semester.school_id
      left join school_classes as school_class on school_class.school_id = school.id
      left join semester_archive_snapshots as snapshot on snapshot.semester_id = semester.id
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
        schoolName: semester.school_name,
        className: semester.class_name,
        studentsAtEnd: semester.students_at_end,
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Daftar semester belum dapat dimuat. Coba lagi.' })
  }
})
