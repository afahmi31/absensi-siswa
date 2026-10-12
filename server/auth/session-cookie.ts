import type { H3Event } from 'h3'

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1'])

export function shouldUseSecureSessionCookie(
  nodeEnvironment: string | undefined,
  protocol: string,
  hostname: string,
): boolean {
  const localHttp = protocol === 'http:' && loopbackHosts.has(hostname.toLowerCase())
  return nodeEnvironment === 'production' && !localHttp
}

/** Production cookies remain Secure except for plain-HTTP loopback browser testing. */
export function sessionCookieOptions(event: H3Event): { cookie: { secure: boolean } } {
  const requestUrl = getRequestURL(event)
  return {
    cookie: {
      secure: shouldUseSecureSessionCookie(process.env.NODE_ENV, requestUrl.protocol, requestUrl.hostname),
    },
  }
}
