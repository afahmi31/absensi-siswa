import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type postgres from 'postgres'

const failureWindowMs = 15 * 60 * 1000
const blockDurationMs = 15 * 60 * 1000
const maxCleanupRows = 100

/** Read Vercel's platform-supplied client address only when running on Vercel. */
export function getSharedThrottleAddress(event: Parameters<typeof getRequestIP>[0]): string | null {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    const address = getRequestHeader(event, 'x-vercel-forwarded-for')?.trim()
    return address && !address.includes(',') && isIP(address) ? address : null
  }

  const address = getRequestIP(event, { xForwardedFor: false }) || event.node.req.socket?.remoteAddress
  return address && isIP(address) ? address : null
}

/** Store only a keyed digest, never the IP address or email used for a login. */
export function hashLoginThrottleAddress(address: string, hmacKey: string): string {
  if (isIP(address) === 0 || Buffer.byteLength(hmacKey, 'utf8') < 32) {
    throw new Error('Online login throttle configuration is invalid.')
  }
  return createHmac('sha256', hmacKey)
    .update('lab002-login-ip-v1\0', 'utf8')
    .update(address, 'utf8')
    .digest('hex')
}

async function deleteExpiredRows(database: postgres.Sql | postgres.TransactionSql, now: Date): Promise<void> {
  await database`
    delete from private.login_throttle_attempts
    where key_hash in (
      select key_hash from private.login_throttle_attempts
      where expires_at <= ${now}
      order by expires_at
      limit ${maxCleanupRows}
    )
  `
}

/** A bounded cleanup on each login check keeps online throttle records short-lived. */
export async function isSharedLoginBlocked(
  database: postgres.Sql | postgres.TransactionSql,
  keyHash: string,
  now = new Date(),
): Promise<boolean> {
  await deleteExpiredRows(database, now)
  const [row] = await database<{ blocked_until: Date | null }[]>`
    select blocked_until
    from private.login_throttle_attempts
    where key_hash = ${keyHash}
  `
  return Boolean(row?.blocked_until && row.blocked_until.getTime() > now.getTime())
}

/** Atomically count a failed login across concurrent serverless instances. */
export async function recordSharedLoginFailure(
  database: postgres.Sql | postgres.TransactionSql,
  keyHash: string,
  now = new Date(),
): Promise<void> {
  await deleteExpiredRows(database, now)
  await database`
    insert into private.login_throttle_attempts as current_attempt (
      key_hash, window_started_at, failure_count, blocked_until, expires_at
    ) values (
      ${keyHash}, ${now}, 1, null, ${new Date(now.getTime() + failureWindowMs)}
    )
    on conflict (key_hash) do update set
      window_started_at = case
        when current_attempt.blocked_until is not null
          and current_attempt.blocked_until <= excluded.window_started_at
          then excluded.window_started_at
        when current_attempt.window_started_at <= excluded.window_started_at - interval '15 minutes'
          then excluded.window_started_at
        else current_attempt.window_started_at
      end,
      failure_count = case
        when current_attempt.blocked_until is not null
          and current_attempt.blocked_until <= excluded.window_started_at
          then 1
        when current_attempt.window_started_at <= excluded.window_started_at - interval '15 minutes'
          then 1
        else least(5, current_attempt.failure_count + 1)
      end,
      blocked_until = case
        when current_attempt.blocked_until > excluded.window_started_at
          then current_attempt.blocked_until
        when current_attempt.blocked_until is not null
          and current_attempt.blocked_until <= excluded.window_started_at
          then null
        when current_attempt.window_started_at <= excluded.window_started_at - interval '15 minutes'
          then null
        when current_attempt.failure_count >= 4
          then excluded.window_started_at + interval '15 minutes'
        else null
      end,
      expires_at = case
        when current_attempt.blocked_until > excluded.window_started_at
          then current_attempt.expires_at
        when current_attempt.blocked_until is not null
          and current_attempt.blocked_until <= excluded.window_started_at
          then excluded.expires_at
        when current_attempt.window_started_at <= excluded.window_started_at - interval '15 minutes'
          then excluded.expires_at
        when current_attempt.failure_count >= 4
          then excluded.window_started_at + interval '30 minutes'
        else excluded.expires_at
      end
  `
}

/** Serialize the whole credential decision for one HMAC key, including writes. */
export async function withSharedLoginAttempt<T>(
  database: postgres.Sql,
  keyHash: string,
  attempt: (transaction: postgres.TransactionSql) => Promise<T>,
): Promise<{ blocked: true } | { blocked: false; value: T }> {
  return database.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtextextended(${'lab002-login-v1:' + keyHash}, 0))`
    if (await isSharedLoginBlocked(transaction, keyHash)) return { blocked: true as const }
    return { blocked: false as const, value: await attempt(transaction) }
  })
}
