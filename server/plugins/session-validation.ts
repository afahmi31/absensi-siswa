import { getAuthenticatedTeacher } from '../auth/teacher-session.ts'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (!session.user) return
    const teacher = await getAuthenticatedTeacher(event)
    if (!teacher) {
      throw createError({ statusCode: 401, statusMessage: 'Sesi sudah berakhir. Silakan masuk lagi.' })
    }
  })
})
