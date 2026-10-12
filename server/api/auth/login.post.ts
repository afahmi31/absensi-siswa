import { randomBytes, randomUUID } from 'node:crypto'
import { findTeacherAuthenticationByEmail } from '../../database/repositories/teacher-accounts.ts'
import { getDatabase } from '../../database/client.ts'
import { isLoginBlocked, recordLoginFailure } from '../../auth/login-throttle.ts'
import { sessionCookieOptions } from '../../auth/session-cookie.ts'
import { createTeacherSession } from '../../database/repositories/teacher-accounts.ts'
import { TEACHER_SESSION_MAX_AGE_SECONDS } from '../../../shared/auth.ts'

interface LoginBody {
  email?: unknown
  password?: unknown
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let dummyPasswordHash: Promise<string> | undefined

function genericLoginFailure(event: Parameters<typeof setResponseHeader>[0], status = 401) {
  setResponseStatus(event, status)
  return { ok: false, message: status === 429 ? 'Terlalu banyak percobaan. Coba lagi nanti.' : 'Email atau kata sandi belum cocok.' }
}

function recordFailure(ip: string): void {
  if (process.env.NODE_ENV !== 'production') recordLoginFailure(ip)
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'vary', 'Origin')

  const ip = getRequestIP(event, { xForwardedFor: false }) || 'unknown'
  if (process.env.NODE_ENV !== 'production' && isLoginBlocked(ip)) return genericLoginFailure(event, 429)

  const body: LoginBody = await readBody<LoginBody>(event).catch((): LoginBody => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email) {
    setResponseStatus(event, 400)
    return { ok: false, fieldErrors: { email: 'Masukkan alamat email.' } }
  }
  if (!password) {
    setResponseStatus(event, 400)
    return { ok: false, fieldErrors: { password: 'Masukkan kata sandi.' } }
  }
  if (email.length > 254 || password.length > 1024 || !emailPattern.test(email)) {
    recordFailure(ip)
    return genericLoginFailure(event)
  }

  let account
  try {
    account = await findTeacherAuthenticationByEmail(getDatabase(), email)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Layanan belum tersedia.' })
  }

  const hash = account?.passwordHash || await (dummyPasswordHash ??= hashPassword(randomBytes(32).toString('base64url')))
  let passwordMatches = false
  try {
    passwordMatches = await verifyPassword(hash, password)
  } catch {
    passwordMatches = false
  }

  if (!account || !account.passwordHash || !passwordMatches) {
    recordFailure(ip)
    return genericLoginFailure(event)
  }

  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + TEACHER_SESSION_MAX_AGE_SECONDS * 1000)
  try {
    await createTeacherSession(getDatabase(), account.id, sessionId, account.sessionVersion, expiresAt)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Layanan belum tersedia.' })
  }
  await replaceUserSession(event, {
    user: { id: account.id, sessionVersion: account.sessionVersion },
    secure: { sessionId },
  }, sessionCookieOptions(event))
  return { ok: true }
})
