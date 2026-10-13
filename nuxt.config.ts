import { TEACHER_SESSION_MAX_AGE_SECONDS } from './shared/auth.ts'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-11',
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  telemetry: false,
  nitro: {
    // Nitro 2.13.4 auto-detection caps Node at 22; this project targets Node 24.
    vercel: { functions: { runtime: 'nodejs24.x', regions: ['sin1'] } },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Website Absensi Siswa',
      meta: [{ name: 'description', content: 'Website Absensi Siswa sedang disiapkan.' }],
    },
  },
  runtimeConfig: {
    databaseUrl: '',
    databaseMode: 'local',
    databaseCa: '',
    loginThrottleHmacKey: '',
    supabaseUrl: '',
    session: {
      name: 'lab002-session',
      password: '',
      maxAge: TEACHER_SESSION_MAX_AGE_SECONDS,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
    },
  },
})
