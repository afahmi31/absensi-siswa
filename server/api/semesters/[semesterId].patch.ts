import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { lockSchoolSemesterChanges, SemesterOperationError, updateSemester } from '../../database/repositories/semesters.ts'
import { requiredUuid, readJsonRecord, safeDatabaseError, validateRequestKeys } from '../../utils/study-api.ts'
import { readSemesterFields } from '../../utils/semester-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = requiredUuid(getRouterParam(event, 'semesterId'), 'semesterId', 'Semester')
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['academicYear', 'term', 'startsOn', 'endsOn'])
  const fields = readSemesterFields(body)

  try {
    const semester = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      const hints = await transaction<{ school_id: string }[]>`
        select semester.school_id
        from semesters as semester
        join schools as school on school.id = semester.school_id
        where semester.id = ${semesterId} and school.teacher_id = ${teacher.id}
      `
      const hint = hints[0]
      if (!hint) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })

      await lockSchoolSemesterChanges(transaction, hint.school_id)
      const currentRows = await transaction<{
        id: string
        school_id: string
        academic_year: string
        term: 'ganjil' | 'genap'
        starts_on: string
        ends_on: string
        status: 'active' | 'closed'
      }[]>`
        select semester.id, semester.school_id, semester.academic_year, semester.term,
               semester.starts_on::text as starts_on, semester.ends_on::text as ends_on, semester.status
        from semesters as semester
        join schools as school on school.id = semester.school_id
        where semester.id = ${semesterId} and school.teacher_id = ${teacher.id}
        for update of semester
      `
      const current = currentRows[0]
      if (!current) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })
      if (current.status !== 'active') throw createError({ statusCode: 409, statusMessage: 'Semester ini sudah menjadi arsip dan tidak dapat diubah.' })

      const [sameLabel] = await transaction<{ id: string }[]>`
        select id from semesters
        where school_id = ${current.school_id}
          and id <> ${current.id}
          and academic_year = ${fields.academicYear}
          and term = ${fields.term}
        limit 1
      `
      if (sameLabel) throw createError({ statusCode: 409, statusMessage: 'Semester untuk tahun ajaran dan jenis ini sudah tersedia.' })

      const [overlap] = await transaction<{ id: string }[]>`
        select id from semesters
        where school_id = ${current.school_id}
          and id <> ${current.id}
          and starts_on <= ${fields.endsOn}
          and ${fields.startsOn} <= ends_on
        limit 1
      `
      if (overlap) throw createError({ statusCode: 409, statusMessage: 'Periode bertumpang tindih dengan semester lain. Ubah tanggalnya lalu coba lagi.' })

      const [membershipConflict] = await transaction<{ id: string }[]>`
        select id from semester_memberships
        where semester_id = ${current.id}
          and (
            starts_on < ${fields.startsOn}
            or starts_on > ${fields.endsOn}
            or (ends_on is not null and (ends_on < ${fields.startsOn} or ends_on > ${fields.endsOn}))
          )
        limit 1
      `
      if (membershipConflict) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Periode baru tidak mencakup masa terdaftar siswa. Perbaiki tanggal siswa terlebih dahulu.',
          data: { reason: 'membership_period_conflict' },
        })
      }

      const [attendanceConflict] = await transaction<{ id: string }[]>`
        select id from attendance_records
        where semester_id = ${current.id}
          and (attendance_date < ${fields.startsOn} or attendance_date > ${fields.endsOn})
        limit 1
      `
      if (attendanceConflict) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Periode baru tidak mencakup catatan absensi atau riwayat yang sudah ada.',
          data: { reason: 'attendance_period_conflict' },
        })
      }

      const saved = await updateSemester(transaction, {
        semesterId: current.id,
        schoolId: current.school_id,
        ...fields,
      })
      if (!saved) throw new SemesterOperationError(404, 'Semester tidak ditemukan atau tidak dapat diakses.')
      return saved
    })

    return {
      ok: true,
      semester: {
        id: semester.id,
        academicYear: semester.academic_year,
        term: semester.term,
        startsOn: semester.starts_on,
        endsOn: semester.ends_on,
        status: semester.status,
      },
    }
  } catch (error) {
    if (error instanceof SemesterOperationError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.statusMessage, data: error.data })
    }
    safeDatabaseError(error)
  }
})
