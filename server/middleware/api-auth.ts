import { assertSameOrigin } from '../auth/same-origin.ts'
import { requireAuthenticatedTeacher } from '../auth/teacher-session.ts'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

function isPublicAuthRoute(path: string, method: string): boolean {
  return (path === '/api/auth/login' && method === 'POST')
    || (path === '/api/auth/session' && method === 'GET')
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  if (!safeMethods.has(event.method)) assertSameOrigin(event)
  if (isPublicAuthRoute(path, event.method)) return
  await requireAuthenticatedTeacher(event)
})
