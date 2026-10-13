import type { H3Event } from 'h3'
import { findTeacherSession } from '../database/repositories/teacher-accounts.ts'
import { getDatabase } from '../database/client.ts'
import { sessionCookieOptions } from './session-cookie.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const authenticatedTeacherCacheKey = Symbol('lab002-authenticated-teacher')

export interface AuthenticatedTeacher {
  id: string
  email: string
  sessionVersion: number
  sessionId: string
}

function unauthorized(): never {
  throw createError({ statusCode: 401, statusMessage: 'Silakan masuk untuk melanjutkan.' })
}

/** Reuse one in-flight teacher lookup only for the lifetime of this H3 request. */
export function getRequestScopedAuthenticatedTeacher(
  event: H3Event,
  load: () => Promise<AuthenticatedTeacher | null>,
): Promise<AuthenticatedTeacher | null> {
  const context = event.context as unknown as Record<PropertyKey, unknown>
  const cached = context[authenticatedTeacherCacheKey] as Promise<AuthenticatedTeacher | null> | undefined
  if (cached) return cached

  // Install the promise before reading the sealed session so all middleware,
  // handlers, and session hooks on this request share the same DB verification.
  const lookup = Promise.resolve().then(load)
  context[authenticatedTeacherCacheKey] = lookup
  return lookup
}

/** Read the sealed identity and compare its version with the database for this request. */
export function getAuthenticatedTeacher(event: H3Event): Promise<AuthenticatedTeacher | null> {
  return getRequestScopedAuthenticatedTeacher(event, () => loadAuthenticatedTeacher(event))
}

async function loadAuthenticatedTeacher(event: H3Event): Promise<AuthenticatedTeacher | null> {
  const session = await getUserSession(event)
  const user = session.user
  if (!user) return null
  if (
    typeof user.id !== 'string'
    || !uuidPattern.test(user.id)
    || !Number.isSafeInteger(user.sessionVersion)
    || user.sessionVersion < 1
    || typeof session.secure?.sessionId !== 'string'
    || !uuidPattern.test(session.secure.sessionId)
  ) {
    await clearUserSession(event, sessionCookieOptions(event))
    return null
  }

  let account
  try {
    account = await findTeacherSession(getDatabase(), user.id, session.secure.sessionId)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Layanan belum tersedia.' })
  }

  if (
    !account
    || !account.isProvisioned
    || account.sessionVersion !== user.sessionVersion
    || !account.isSessionActive
  ) {
    await clearUserSession(event, sessionCookieOptions(event))
    return null
  }
  return {
    id: account.id,
    email: account.email,
    sessionVersion: account.sessionVersion,
    sessionId: session.secure.sessionId,
  }
}

export async function requireAuthenticatedTeacher(event: H3Event): Promise<AuthenticatedTeacher> {
  const teacher = await getAuthenticatedTeacher(event)
  if (!teacher) unauthorized()
  return teacher
}
