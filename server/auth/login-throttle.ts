interface AttemptWindow {
  startedAt: number
  failures: number
  blockedUntil: number
}

const windows = new Map<string, AttemptWindow>()
const windowMs = 15 * 60 * 1000
const failureLimit = 5
const blockMs = 15 * 60 * 1000
const maxKeys = 5000

/** Process-local development throttle. It is intentionally not presented as a multi-instance production control. */
export function isLoginBlocked(ip: string, now = Date.now()): boolean {
  const attempt = windows.get(ip)
  if (!attempt) return false
  if (attempt.blockedUntil > now) return true
  if (attempt.blockedUntil || now - attempt.startedAt >= windowMs) windows.delete(ip)
  return false
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  let attempt = windows.get(ip)
  if (
    !attempt
    || now - attempt.startedAt >= windowMs
    || (attempt.blockedUntil > 0 && attempt.blockedUntil <= now)
  ) {
    attempt = { startedAt: now, failures: 0, blockedUntil: 0 }
    windows.set(ip, attempt)
  }
  attempt.failures += 1
  if (attempt.failures >= failureLimit) attempt.blockedUntil = now + blockMs

  if (windows.size > maxKeys) {
    for (const [key, value] of windows) {
      if (value.blockedUntil <= now && now - value.startedAt >= windowMs) windows.delete(key)
      if (windows.size <= maxKeys) break
    }
    if (windows.size > maxKeys) windows.delete(windows.keys().next().value as string)
  }
}
