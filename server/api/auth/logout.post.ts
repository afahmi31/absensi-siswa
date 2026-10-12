import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { revokeTeacherSession } from '../../auth/account-admin.ts'
import { getDatabase } from '../../database/client.ts'
import { sessionCookieOptions } from '../../auth/session-cookie.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  try {
    await revokeTeacherSession(getDatabase(), teacher.id, teacher.sessionId, teacher.sessionVersion)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Layanan belum tersedia.' })
  }
  await clearUserSession(event, sessionCookieOptions(event))
  return { ok: true }
})
