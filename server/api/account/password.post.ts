import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { changeOwnPassword } from '../../auth/change-password.ts'
import { getDatabase } from '../../database/client.ts'
import { sessionCookieOptions } from '../../auth/session-cookie.ts'
import { passwordErrors, passwordFields } from '../../../shared/password.ts'
import { validateRequestKeys, readJsonRecord } from '../../utils/study-api.ts'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const body = await readJsonRecord(event)
  validateRequestKeys(body, [...passwordFields])
  const errors = passwordErrors(body)
  if (Object.keys(errors).length) throw createError({ statusCode: 422, statusMessage: 'Periksa kembali data yang dimasukkan.', data: { fieldErrors: errors } })
  let result
  try { result = await changeOwnPassword(getDatabase(), teacher, body.currentPassword as string, body.newPassword as string, verifyPassword, hashPassword) }
  catch { throw createError({ statusCode: 503, statusMessage: 'Perubahan belum tersimpan. Coba lagi.' }) }
  if (result.blocked) throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak permintaan. Coba lagi nanti.' })
  if (result.value === 'stale') throw createError({ statusCode: 401, statusMessage: 'Sesi sudah berakhir. Silakan masuk lagi.' })
  if (result.value === 'incorrect') throw createError({ statusCode: 422, statusMessage: 'Periksa kembali data yang dimasukkan.', data: { fieldErrors: { currentPassword: 'Kata sandi saat ini belum cocok.' } } })
  await clearUserSession(event, sessionCookieOptions(event))
  return { ok: true }
})
