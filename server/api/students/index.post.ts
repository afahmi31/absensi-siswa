import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { lockSchoolSemesterChanges } from '../../database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../../database/repositories/students.ts'
import {
  optionalGender,
  optionalIsoDate,
  optionalText,
  readJsonRecord,
  requiredText,
  requiredUuid,
  safeDatabaseError,
  validateRequestKeys,
} from '../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['semesterId', 'fullName', 'studentNumber', 'gender', 'startsOn', 'endsOn'])
  const semesterId = requiredUuid(body.semesterId, 'semesterId', 'Semester')
  const fullName = requiredText(body.fullName, 'fullName', 'Nama siswa', 200)
  const studentNumber = optionalText(body.studentNumber, 'studentNumber', 'NIPD', 80)
  const gender = optionalGender(body.gender)
  const startsOn = optionalIsoDate(body.startsOn, 'startsOn', 'Tanggal masuk')
  const endsOn = optionalIsoDate(body.endsOn, 'endsOn', 'Tanggal keluar')

  try {
    const membership = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      const ownedSemesters = await transaction<{ school_id: string }[]>`
        select semester.school_id
        from semesters as semester
        join schools as school on school.id = semester.school_id
        where semester.id = ${semesterId} and school.teacher_id = ${teacher.id}
      `
      const ownedSemester = ownedSemesters[0]
      if (!ownedSemester) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })

      await lockSchoolSemesterChanges(transaction, ownedSemester.school_id)

      const scopes = await transaction<{
        school_id: string
        class_id: string | null
        starts_on: string
        ends_on: string
        status: 'active' | 'closed'
      }[]>`
        select school.id as school_id, school_class.id as class_id,
               semester.starts_on::text as starts_on, semester.ends_on::text as ends_on,
               semester.status
        from semesters as semester
        join schools as school on school.id = semester.school_id
        left join school_classes as school_class on school_class.school_id = school.id
        where semester.id = ${semesterId} and school.teacher_id = ${teacher.id}
        for share of semester, school
      `
      const scope = scopes[0]
      if (!scope) throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })
      if (scope.school_id !== ownedSemester.school_id) throw createError({ statusCode: 409, statusMessage: 'Periksa kembali semester lalu coba lagi.' })
      if (scope.status !== 'active') throw createError({ statusCode: 409, statusMessage: 'Semester ini sudah menjadi arsip dan hanya dapat dilihat.' })
      if (!scope.class_id) throw createError({ statusCode: 409, statusMessage: 'Data kelas belum siap. Perbarui data sekolah terlebih dahulu.' })

      const membershipStart = startsOn ?? scope.starts_on
      if (membershipStart < scope.starts_on || membershipStart > scope.ends_on) {
        throw createError({ statusCode: 422, statusMessage: 'Tanggal masuk harus berada di dalam periode semester.', data: { fieldErrors: { startsOn: 'Pilih tanggal di dalam periode semester.' } } })
      }
      if (endsOn && (endsOn < membershipStart || endsOn > scope.ends_on)) {
        throw createError({ statusCode: 422, statusMessage: 'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.', data: { fieldErrors: { endsOn: 'Pilih tanggal setelah tanggal masuk dan dalam periode semester.' } } })
      }

      const student = await createStudent(transaction, { fullName, studentNumber, gender })
      return addStudentToSemester(transaction, {
        semesterId,
        schoolId: scope.school_id,
        schoolClassId: scope.class_id,
        studentId: student.id,
        startsOn: membershipStart,
        endsOn,
      })
    })
    return { ok: true, membershipId: membership.id }
  } catch (error) {
    safeDatabaseError(error)
  }
})
