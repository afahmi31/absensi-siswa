import type { H3Event } from 'h3'

export function assertSameOrigin(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || origin === 'null') {
    throw createError({ statusCode: 403, statusMessage: 'Permintaan tidak dapat diproses.' })
  }

  let parsedOrigin: URL
  try {
    parsedOrigin = new URL(origin)
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Permintaan tidak dapat diproses.' })
  }
  if (parsedOrigin.origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: 'Permintaan tidak dapat diproses.' })
  }
}
