import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { updateStudentIdentity, updateStudentMembershipPeriod } from '../../database/repositories/students.ts'
import {
  isUuid,
  optionalGender,
  optionalIsoDate,
  optionalText,
  readJsonRecord,
  requiredText,
  safeDatabaseError,
  validateRequestKeys,
} from '../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const membershipId = getRouterParam(event, 'membershipId')
  if (!isUuid(membershipId)) throw createError({ statusCode: 404, statusMessage: 'Data siswa tidak ditemukan.' })
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['fullName', 'studentNumber', 'gender', 'startsOn', 'endsOn'])

  const fullName = Object.hasOwn(body, 'fullName') ? requiredText(body.fullName, 'fullName', 'Nama siswa', 200) : undefined
  const studentNumber = Object.hasOwn(body, 'studentNumber') ? optionalText(body.studentNumber, 'studentNumber', 'NIPD', 80) : undefined
  const gender = Object.hasOwn(body, 'gender') ? optionalGender(body.gender) : undefined
  const startsOn = Object.hasOwn(body, 'startsOn') ? optionalIsoDate(body.startsOn, 'startsOn', 'Tanggal masuk') : undefined
  const endsOn = Object.hasOwn(body, 'endsOn') ? optionalIsoDate(body.endsOn, 'endsOn', 'Tanggal keluar') : undefined

  try {
    const result = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      const rows = await transaction<{
        student_id: string
        full_name: string
        student_number: string | null
        gender: 'L' | 'P' | null
        starts_on: string
        ends_on: string | null
        semester_starts_on: string
        semester_ends_on: string
        semester_status: 'active' | 'closed'
      }[]>`
        select membership.student_id, student.full_name, student.student_number, student.gender,
               membership.starts_on::text as starts_on, membership.ends_on::text as ends_on,
               semester.starts_on::text as semester_starts_on, semester.ends_on::text as semester_ends_on,
               semester.status as semester_status
        from semester_memberships as membership
        join semesters as semester on semester.id = membership.semester_id
        join schools as school on school.id = membership.school_id
        join students as student on student.id = membership.student_id
        where membership.id = ${membershipId} and school.teacher_id = ${teacher.id}
        for update of membership, semester, student
      `
      const current = rows[0]
      if (!current) throw createError({ statusCode: 404, statusMessage: 'Data siswa tidak ditemukan atau tidak dapat diakses.' })
      if (current.semester_status !== 'active') throw createError({ statusCode: 409, statusMessage: 'Semester ini sudah menjadi arsip dan hanya dapat dilihat.' })

      const nextName = fullName ?? current.full_name
      const nextStudentNumber = studentNumber === undefined ? current.student_number : studentNumber
      const nextGender = gender === undefined ? current.gender : gender
      const nextStartsOn = startsOn === undefined ? current.starts_on : startsOn ?? current.semester_starts_on
      const nextEndsOn = endsOn === undefined ? current.ends_on : endsOn
      if (nextStartsOn < current.semester_starts_on || nextStartsOn > current.semester_ends_on) {
        throw createError({ statusCode: 422, statusMessage: 'Tanggal masuk harus berada di dalam periode semester.', data: { fieldErrors: { startsOn: 'Pilih tanggal di dalam periode semester.' } } })
      }
      if (nextEndsOn && (nextEndsOn < nextStartsOn || nextEndsOn > current.semester_ends_on)) {
        throw createError({ statusCode: 422, statusMessage: 'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.', data: { fieldErrors: { endsOn: 'Pilih tanggal setelah tanggal masuk dan dalam periode semester.' } } })
      }

      const identityChanged = nextName !== current.full_name
        || nextStudentNumber !== current.student_number
        || nextGender !== current.gender
      if (identityChanged) {
        const foreignMemberships = await transaction<{ found: boolean }[]>`
          select exists (
            select 1
            from semester_memberships as other_membership
            join semesters as other_semester on other_semester.id = other_membership.semester_id
            join schools as other_school on other_school.id = other_semester.school_id
            where other_membership.student_id = ${current.student_id}
              and other_semester.status = 'active'
              and other_school.teacher_id <> ${teacher.id}
          ) as found
        `
        if (foreignMemberships[0]?.found) {
          throw createError({ statusCode: 409, statusMessage: 'Identitas siswa tidak dapat diubah dari sekolah ini karena masih digunakan pada data aktif lain.' })
        }
        await updateStudentIdentity(transaction, current.student_id, {
          fullName: nextName,
          studentNumber: nextStudentNumber,
          gender: nextGender,
        })
      }

      if (nextStartsOn !== current.starts_on || nextEndsOn !== current.ends_on) {
        await updateStudentMembershipPeriod(transaction, membershipId, { startsOn: nextStartsOn, endsOn: nextEndsOn })
      }
      return { ok: true }
    })
    return result
  } catch (error) {
    safeDatabaseError(error)
  }
})
