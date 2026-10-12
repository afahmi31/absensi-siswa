import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { copyRosterFromPreviousSemester, createSemester, lockSchoolSemesterChanges } from '../../database/repositories/semesters.ts'
import { readJsonRecord, safeDatabaseError, validateRequestKeys } from '../../utils/study-api.ts'
import { readSemesterFields } from '../../utils/semester-api.ts'

interface PreviousSemester {
  id: string
  academic_year: string
  term: 'ganjil' | 'genap'
  ends_on: string
  students_at_end: number
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['academicYear', 'term', 'startsOn', 'endsOn', 'rosterSource'])
  const fields = readSemesterFields(body)
  if (body.rosterSource !== 'previous' && body.rosterSource !== 'empty') {
    throw createError({
      statusCode: 422,
      statusMessage: 'Pilih salin daftar semester sebelumnya atau mulai dengan daftar kosong.',
      data: { fieldErrors: { rosterSource: 'Pilih cara menyiapkan daftar siswa.' } },
    })
  }

  try {
    const result = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      const scopes = await transaction<{ school_id: string; class_id: string | null }[]>`
        select school.id as school_id, school_class.id as class_id
        from schools as school
        left join school_classes as school_class on school_class.school_id = school.id
        where school.teacher_id = ${teacher.id}
        for share of school
      `
      const scope = scopes[0]
      if (!scope) throw createError({ statusCode: 409, statusMessage: 'Simpan data sekolah dan kelas sebelum membuat semester.' })
      if (!scope.class_id) throw createError({ statusCode: 409, statusMessage: 'Data kelas belum siap. Perbarui data sekolah terlebih dahulu.' })

      await lockSchoolSemesterChanges(transaction, scope.school_id)
      const [active] = await transaction<{ id: string }[]>`
        select id from semesters where school_id = ${scope.school_id} and status = 'active' limit 1
      `
      if (active) throw createError({ statusCode: 409, statusMessage: 'Tutup semester aktif sebelum membuat semester baru.' })

      const [sameLabel] = await transaction<{ id: string }[]>`
        select id from semesters
        where school_id = ${scope.school_id}
          and academic_year = ${fields.academicYear}
          and term = ${fields.term}
        limit 1
      `
      if (sameLabel) throw createError({ statusCode: 409, statusMessage: 'Semester untuk tahun ajaran dan jenis ini sudah tersedia.' })

      const [overlap] = await transaction<{ id: string }[]>`
        select id from semesters
        where school_id = ${scope.school_id}
          and starts_on <= ${fields.endsOn}
          and ${fields.startsOn} <= ends_on
        limit 1
      `
      if (overlap) throw createError({ statusCode: 409, statusMessage: 'Periode bertumpang tindih dengan semester lain. Ubah tanggalnya lalu coba lagi.' })

      let previousSemester: PreviousSemester | null = null
      if (body.rosterSource === 'previous') {
        const previousRows = await transaction<PreviousSemester[]>`
          select previous.id, previous.academic_year, previous.term,
                 previous.ends_on::text as ends_on,
                 count(membership.id)::int as students_at_end
          from semesters as previous
          left join semester_memberships as membership
            on membership.semester_id = previous.id
           and membership.starts_on <= previous.ends_on
           and (membership.ends_on is null or membership.ends_on >= previous.ends_on)
          where previous.school_id = ${scope.school_id}
            and previous.status = 'closed'
            and previous.ends_on < ${fields.startsOn}
          group by previous.id
          order by previous.ends_on desc, previous.starts_on desc
          limit 1
        `
        previousSemester = previousRows[0] ?? null
        if (!previousSemester) {
          throw createError({ statusCode: 409, statusMessage: 'Semester arsip sebelumnya tidak ditemukan. Pilih daftar kosong atau ubah tanggal mulai.' })
        }
      }

      const semester = await createSemester(transaction, {
        schoolId: scope.school_id,
        ...fields,
      })
      const copied = previousSemester
        ? await copyRosterFromPreviousSemester(transaction, {
            previousSemesterId: previousSemester.id,
            targetSemesterId: semester.id,
          })
        : []

      return { semester, copiedCount: copied.length, previousSemester }
    })

    return {
      ok: true,
      semester: {
        id: result.semester.id,
        academicYear: result.semester.academic_year,
        term: result.semester.term,
        startsOn: result.semester.starts_on,
        endsOn: result.semester.ends_on,
        status: result.semester.status,
      },
      roster: {
        source: body.rosterSource,
        copiedCount: result.copiedCount,
        previousSemester: result.previousSemester
          ? {
              id: result.previousSemester.id,
              academicYear: result.previousSemester.academic_year,
              term: result.previousSemester.term,
              endsOn: result.previousSemester.ends_on,
            }
          : null,
      },
    }
  } catch (error) {
    safeDatabaseError(error)
  }
})
