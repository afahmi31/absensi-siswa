import { randomBytes, randomUUID } from 'node:crypto'
import { createTeacherSession, findTeacherAuthenticationByEmail } from '../../database/repositories/teacher-accounts.ts'
import { getDatabase } from '../../database/client.ts'
import { isLoginBlocked, recordLoginFailure } from '../../auth/login-throttle.ts'
import { sessionCookieOptions } from '../../auth/session-cookie.ts'
import {
  getSharedThrottleAddress,
  hashLoginThrottleAddress,
  isSharedLoginBlocked,
  recordSharedLoginFailure,
  withSharedLoginAttempt,
} from '../../auth/shared-login-throttle.ts'
import { TEACHER_SESSION_MAX_AGE_SECONDS } from '../../../shared/auth.ts'

interface LoginBody {
  email?: unknown
  password?: unknown
}

interface AuthenticatedTeacher {
  id: string
  sessionVersion: number
}

interface CreatedTeacherSession {
  teacher: AuthenticatedTeacher
  sessionId: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let dummyPasswordHash: Promise<string> | undefined

function genericLoginFailure(event: Parameters<typeof setResponseHeader>[0], status = 401) {
  setResponseStatus(event, status)
  return { ok: false, message: status === 429 ? 'Terlalu banyak percobaan. Coba lagi nanti.' : 'Email atau kata sandi belum cocok.' }
}

function serviceUnavailable() {
  return createError({ statusCode: 503, statusMessage: 'Layanan belum tersedia.' })
}

async function authenticate(database: Parameters<typeof findTeacherAuthenticationByEmail>[0], email: string, password: string): Promise<CreatedTeacherSession | null> {
  let account
  try {
    account = await findTeacherAuthenticationByEmail(database, email)
  } catch {
    throw serviceUnavailable()
  }

  const hash = account?.passwordHash || await (dummyPasswordHash ??= hashPassword(randomBytes(32).toString('base64url')))
  let passwordMatches = false
  try {
    passwordMatches = await verifyPassword(hash, password)
  } catch {
    passwordMatches = false
  }

  if (!account || !account.passwordHash || !passwordMatches) return null

  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + TEACHER_SESSION_MAX_AGE_SECONDS * 1000)
  try {
    await createTeacherSession(database, account.id, sessionId, account.sessionVersion, expiresAt)
  } catch {
    throw serviceUnavailable()
  }

  return { teacher: { id: account.id, sessionVersion: account.sessionVersion }, sessionId }
}

async function setTeacherSession(event: Parameters<typeof setResponseHeader>[0], result: CreatedTeacherSession) {
  await replaceUserSession(event, {
    user: { id: result.teacher.id, sessionVersion: result.teacher.sessionVersion },
    secure: { sessionId: result.sessionId },
  }, sessionCookieOptions(event))
  return { ok: true }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'vary', 'Origin')

  const config = useRuntimeConfig(event)
  const mode = config.databaseMode
  const sharedThrottleMode = mode === 'supabase'
  let localIp = ''
  let sharedKeyHash = ''
  if (sharedThrottleMode) {
    const address = getSharedThrottleAddress(event)
    if (!address || typeof config.loginThrottleHmacKey !== 'string') throw serviceUnavailable()
    try {
      sharedKeyHash = hashLoginThrottleAddress(address, config.loginThrottleHmacKey)
      if (await isSharedLoginBlocked(getDatabase(), sharedKeyHash)) return genericLoginFailure(event, 429)
    } catch {
      throw serviceUnavailable()
    }
  } else if (mode === 'local') {
    localIp = getRequestIP(event, { xForwardedFor: false }) || 'unknown'
    if (process.env.NODE_ENV !== 'production' && isLoginBlocked(localIp)) return genericLoginFailure(event, 429)
  } else {
    throw serviceUnavailable()
  }

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

  const validEmail = email.length <= 254 && password.length <= 1024 && emailPattern.test(email)
  if (sharedThrottleMode) {
    try {
      const outcome = await withSharedLoginAttempt(getDatabase(), sharedKeyHash, async (transaction) => {
        if (!validEmail) {
          await recordSharedLoginFailure(transaction, sharedKeyHash)
          return null
        }
        const result = await authenticate(transaction, email, password)
        if (!result) await recordSharedLoginFailure(transaction, sharedKeyHash)
        return result
      })
      if (outcome.blocked) return genericLoginFailure(event, 429)
      if (!validEmail || !outcome.value) return genericLoginFailure(event)
      return await setTeacherSession(event, outcome.value)
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 503) throw error
      throw serviceUnavailable()
    }
  }

  const recordLocalFailure = () => {
    if (process.env.NODE_ENV !== 'production') recordLoginFailure(localIp)
  }
  if (!validEmail) {
    recordLocalFailure()
    return genericLoginFailure(event)
  }

  const result = await authenticate(getDatabase(), email, password)
  if (!result) {
    recordLocalFailure()
    return genericLoginFailure(event)
  }
  return await setTeacherSession(event, result)
})
