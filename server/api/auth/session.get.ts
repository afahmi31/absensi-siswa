import { getAuthenticatedTeacher } from '../../auth/teacher-session.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await getAuthenticatedTeacher(event)
  if (!teacher) return { authenticated: false }
  return { authenticated: true, email: teacher.email }
})
