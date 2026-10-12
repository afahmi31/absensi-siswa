import { withAuditActor } from '../database/audit-context.ts'
import { inDatabaseTransaction, type DatabaseExecutor } from '../database/transaction.ts'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const scryptHashPattern = /^\$scrypt\$n=\d+,r=\d+,p=\d+\$[^$]+\$[^$]+$/

export interface ProvisionedTeacherAccount {
  id: string
  email: string
  sessionVersion: number
}

function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (normalized.length > 254 || !emailPattern.test(normalized)) {
    throw new Error('A valid teacher email address is required.')
  }
  return normalized
}

function validatePasswordHash(passwordHash: string): void {
  if (passwordHash.length > 512 || !scryptHashPattern.test(passwordHash)) {
    throw new Error('The teacher password must be stored as an Adonis scrypt hash.')
  }
}

/** Owner-only bootstrap path. It refuses to overwrite any existing teacher account. */
export async function provisionTeacherAccount(
  database: DatabaseExecutor,
  email: string,
  passwordHash: string,
): Promise<ProvisionedTeacherAccount> {
  const normalizedEmail = validateEmail(email)
  validatePasswordHash(passwordHash)

  return inDatabaseTransaction(database, async (transaction) => {
    await transaction`select pg_advisory_xact_lock(1710, 2)`
    const [count] = await transaction`select count(*)::int as count from teacher_accounts`
    if (!count || count.count !== 0) throw new Error('A teacher account already exists; use the explicit owner reset command.')

    const [account] = await transaction<ProvisionedTeacherAccount[]>`
      insert into teacher_accounts (email, password_hash)
      values (${normalizedEmail}, ${passwordHash})
      returning id, email, session_version as "sessionVersion"
    `
    if (!account) throw new Error('Teacher account was not created.')
    return account
  })
}

/** Owner-only reset path. A version change makes every earlier sealed session stale. */
export async function resetTeacherAccountPassword(
  database: DatabaseExecutor,
  passwordHash: string,
): Promise<ProvisionedTeacherAccount> {
  validatePasswordHash(passwordHash)

  return inDatabaseTransaction(database, async (transaction) => {
    await transaction`select pg_advisory_xact_lock(1710, 2)`
    const accounts = await transaction<{ id: string; email: string }[]>`
      select id, email from teacher_accounts order by created_at for update
    `
    if (accounts.length !== 1) {
      throw new Error('Password reset requires exactly one existing teacher account.')
    }

    const account = accounts[0]
    if (!account) throw new Error('Teacher account was not found.')
    const updatedAccount = await withAuditActor(transaction, account.id, async (actorTransaction) => {
      const [updated] = await actorTransaction<ProvisionedTeacherAccount[]>`
        update teacher_accounts
        set password_hash = ${passwordHash}, session_version = session_version + 1
        where id = ${account.id}
        returning id, email, session_version as "sessionVersion"
      `
      await actorTransaction`
        update teacher_sessions
        set revoked_at = clock_timestamp()
        where teacher_id = ${account.id} and revoked_at is null
      `
      return updated
    })
    if (!updatedAccount) throw new Error('Teacher account password was not reset.')
    return updatedAccount
  })
}

/** Revoke only the selected device session when the teacher logs out. */
export async function revokeTeacherSession(
  database: DatabaseExecutor,
  teacherId: string,
  sessionId: string,
  sessionVersion: number,
): Promise<void> {
  const [revoked] = await withAuditActor(database, teacherId, (transaction) => transaction<{ id: string }[]>`
    update teacher_sessions
    set revoked_at = clock_timestamp()
    where id = ${sessionId} and teacher_id = ${teacherId}
      and session_version = ${sessionVersion} and revoked_at is null
    returning id
  `)
  if (!revoked) throw new Error('Teacher session was not revoked.')
}
