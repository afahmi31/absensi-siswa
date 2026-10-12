import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import { createSchool, createSchoolClass, updateSchoolClass, updateSchoolForTeacher } from '../../database/repositories/schools.ts'
import {
  isValidIanaTimeZone,
  readJsonRecord,
  requiredText,
  safeDatabaseError,
  validateRequestKeys,
} from '../../utils/study-api.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const body = await readJsonRecord(event)
  validateRequestKeys(body, ['name', 'className', 'timeZone'])
  const name = requiredText(body.name, 'name', 'Nama sekolah', 120)
  const className = requiredText(body.className, 'className', 'Nama kelas', 80)
  const timeZone = body.timeZone === undefined
    ? 'Asia/Jakarta'
    : typeof body.timeZone === 'string' ? body.timeZone.trim() : ''
  if (!timeZone || timeZone.length > 100 || !isValidIanaTimeZone(timeZone)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Pilih zona waktu sekolah yang valid.',
      data: { fieldErrors: { timeZone: 'Pilih zona waktu sekolah yang valid.' } },
    })
  }

  try {
    const school = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      const current = await transaction<{ id: string }[]>`
        select id from schools where teacher_id = ${teacher.id} for update
      `
      if (current[0]) {
        const saved = await updateSchoolForTeacher(transaction, { teacherId: teacher.id, name, timeZone })
        const existingClass = await transaction<{ id: string }[]>`
          select id from school_classes where school_id = ${saved.id} for update
        `
        if (existingClass[0]) await updateSchoolClass(transaction, { schoolId: saved.id, name: className })
        else await createSchoolClass(transaction, { schoolId: saved.id, name: className })
        return { id: saved.id, name: saved.name, timeZone: saved.time_zone, className }
      }

      const created = await createSchool(transaction, { teacherId: teacher.id, name, timeZone })
      await createSchoolClass(transaction, { schoolId: created.id, name: className })
      return { id: created.id, name: created.name, timeZone: created.time_zone, className }
    })
    return { ok: true, school }
  } catch (error) {
    safeDatabaseError(error)
  }
})
