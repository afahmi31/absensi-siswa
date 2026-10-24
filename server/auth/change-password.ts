import { createHash } from 'node:crypto'
import type { AuthenticatedTeacher } from './teacher-session.ts'
import { withSharedLoginAttempt, recordSharedLoginFailure } from './shared-login-throttle.ts'

/** Account-scoped purpose-separated key: no login IP counter or credential is stored. */
export function passwordThrottleKey(teacherId: string): string { return createHash('sha256').update('lab002-password-change-v1\0' + teacherId).digest('hex') }

export async function changeOwnPassword(database: Parameters<typeof withSharedLoginAttempt>[0], teacher: AuthenticatedTeacher, current: string, next: string,
  verify: (hash: string, password: string) => Promise<boolean>, hash: (password: string) => Promise<string>) {
  // The same PostgreSQL counter works in local and multi-instance Supabase mode.
  // Every attempt for an account is serialized; failed verifications commit the counter.
  const key = passwordThrottleKey(teacher.id)
  return withSharedLoginAttempt(database, key, async (transaction) => {
    const [account] = await transaction<{ password_hash: string | null; session_version: number }[]>`select password_hash,session_version from public.teacher_accounts where id=${teacher.id}`
    const [device] = await transaction<{ active: boolean }[]>`select (revoked_at is null and expires_at>clock_timestamp() and session_version=${teacher.sessionVersion}) as active from public.teacher_sessions where id=${teacher.sessionId} and teacher_id=${teacher.id}`
    if (!account?.password_hash || account.session_version !== teacher.sessionVersion || !device?.active) return 'stale' as const
    if (!await verify(account.password_hash, current)) { await recordSharedLoginFailure(transaction, key); return 'incorrect' as const }
    const newHash = await hash(next)
    const [result] = await transaction<{ changed: boolean }[]>`select private.change_teacher_password(${teacher.id}::uuid,${teacher.sessionId}::uuid,${teacher.sessionVersion},${account.password_hash},${newHash}) as changed`
    return result?.changed ? 'changed' as const : 'stale' as const
  })
}
