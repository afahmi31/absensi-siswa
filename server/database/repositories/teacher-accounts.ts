import { inDatabaseTransaction, type DatabaseExecutor } from '../transaction.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface TeacherAccount {
  id: string
  email: string
}

export interface TeacherAuthenticationRecord extends TeacherAccount {
  passwordHash: string | null
  sessionVersion: number
}

export async function createTeacherAccount(database: DatabaseExecutor, email: string): Promise<TeacherAccount> {
  const [account] = await database<TeacherAccount[]>`
    insert into teacher_accounts (email) values (${email}) returning id, email
  `
  if (!account) throw new Error('Teacher account was not created.')
  return account
}

export async function findTeacherAccountByEmail(database: DatabaseExecutor, email: string): Promise<TeacherAccount | null> {
  const rows = await database<TeacherAccount[]>`
    select id, email from teacher_accounts where lower(btrim(email)) = lower(btrim(${email}))
  `
  return rows[0] ?? null
}

/** Read only the credential verifier and revocation version needed by auth; callers must never serialize this row. */
export async function findTeacherAuthenticationByEmail(
  database: DatabaseExecutor,
  email: string,
): Promise<TeacherAuthenticationRecord | null> {
  const rows = await database<TeacherAuthenticationRecord[]>`
    select id, email, password_hash as "passwordHash", session_version as "sessionVersion"
    from teacher_accounts
    where lower(btrim(email)) = lower(btrim(${email}))
  `
  return rows[0] ?? null
}

export interface TeacherSessionRecord extends TeacherAccount {
  sessionVersion: number
  isProvisioned: boolean
  isSessionActive: boolean
}

/** Look up one server-side session without returning a password hash. */
export async function findTeacherSession(
  database: DatabaseExecutor,
  teacherId: string,
  sessionId: string,
): Promise<TeacherSessionRecord | null> {
  const rows = await database<TeacherSessionRecord[]>`
    select account.id, account.email,
      account.session_version as "sessionVersion",
      account.password_hash is not null as "isProvisioned",
      (
        session.session_version = account.session_version
        and session.revoked_at is null
        and session.expires_at > statement_timestamp()
      ) as "isSessionActive"
    from teacher_accounts as account
    join teacher_sessions as session on session.teacher_id = account.id
    where account.id = ${teacherId} and session.id = ${sessionId}
  `
  return rows[0] ?? null
}

/** Persist a device session only if its password/account version is still current. */
export async function createTeacherSession(
  database: DatabaseExecutor,
  teacherId: string,
  sessionId: string,
  sessionVersion: number,
  expiresAt: Date,
): Promise<void> {
  if (!uuidPattern.test(teacherId) || !uuidPattern.test(sessionId)) {
    throw new Error('Teacher and session IDs must be UUIDs.')
  }
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 1) {
    throw new Error('Teacher session version is invalid.')
  }
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('Teacher session expiry must be a future date.')
  }

  await inDatabaseTransaction(database, async (transaction) => {
    const accounts = await transaction<{ sessionVersion: number }[]>`
      select session_version as "sessionVersion"
      from teacher_accounts
      where id = ${teacherId} and password_hash is not null
      for share
    `
    if (accounts[0]?.sessionVersion !== sessionVersion) {
      throw new Error('Teacher account changed while login was in progress.')
    }

    await transaction`
      insert into teacher_sessions (id, teacher_id, session_version, expires_at)
      values (${sessionId}, ${teacherId}, ${sessionVersion}, ${expiresAt})
    `
  })
}
