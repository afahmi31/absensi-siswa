interface AuthSessionResponse {
  authenticated: boolean
}

export default defineNuxtRouteMiddleware(async (to) => {
  const requestFetch = useRequestFetch()
  const session = await requestFetch<AuthSessionResponse>('/api/auth/session')
  const isLoginPage = to.path === '/login'

  if (session.authenticated && isLoginPage) return navigateTo('/')
  if (!session.authenticated && !isLoginPage) return navigateTo('/login')
})
