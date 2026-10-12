import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'
import { requiredUuid } from '../../utils/study-api.ts'

const pageSize = 30

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const query = getQuery(event)
  const semesterValue = typeof query.semesterId === 'string' ? query.semesterId : ''
  const semesterId = requiredUuid(semesterValue, 'semesterId', 'Semester')
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''
  const requestedPage = typeof query.page === 'string' && /^\d+$/.test(query.page) ? Number(query.page) : 1
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1
  const offset = (page - 1) * pageSize

  try {
    const database = getDatabase()
    const semesters = await database<{ id: string; status: 'active' | 'closed'; starts_on: string; ends_on: string }[]>`
      select semester.id, semester.status,
             semester.starts_on::text as starts_on, semester.ends_on::text as ends_on
      from semesters as semester
      join schools as school on school.id = semester.school_id
      where semester.id = ${semesterId} and school.teacher_id = ${teacher.id}
    `
    const semester = semesters[0]
    if (!semester) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })

    const [count] = await database<{ total: number }[]>`
      select count(*)::int as total
      from semester_memberships as membership
      where membership.semester_id = ${semesterId}
        and ( ${search} = ''
          or strpos(lower(membership.name_snapshot), lower(${search})) > 0
          or strpos(lower(coalesce(membership.student_number_snapshot, '')), lower(${search})) > 0 )
    `
    const total = count?.total ?? 0
    const rows = await database<{
      membership_id: string
      full_name: string
      student_number: string | null
      gender: 'L' | 'P' | null
      starts_on: string
      ends_on: string | null
      membership_status: 'upcoming' | 'current' | 'ended'
    }[]>`
      select membership.id as membership_id,
             membership.name_snapshot as full_name,
             membership.student_number_snapshot as student_number,
             membership.gender_snapshot as gender,
             membership.starts_on::text as starts_on,
             membership.ends_on::text as ends_on,
             case
               when local.school_today < membership.starts_on then 'upcoming'
               when local.school_today > coalesce(membership.ends_on, 'infinity'::date) then 'ended'
               else 'current'
             end as membership_status
      from semester_memberships as membership
      cross join lateral (select school_local_today(membership.school_id) as school_today) as local
      where membership.semester_id = ${semesterId}
        and ( ${search} = ''
          or strpos(lower(membership.name_snapshot), lower(${search})) > 0
          or strpos(lower(coalesce(membership.student_number_snapshot, '')), lower(${search})) > 0 )
      order by lower(membership.name_snapshot), membership.id
      limit ${pageSize} offset ${offset}
    `
    return {
      semester: { id: semester.id, status: semester.status, startsOn: semester.starts_on, endsOn: semester.ends_on },
      students: rows.map((row) => ({
        membershipId: row.membership_id,
        fullName: row.full_name,
        studentNumber: row.student_number ?? '',
        gender: row.gender ?? '',
        startsOn: row.starts_on,
        endsOn: row.ends_on ?? '',
        membershipStatus: row.membership_status,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Daftar siswa belum dapat dimuat. Coba lagi.' })
  }
})
