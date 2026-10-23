import { createRequire } from 'node:module'
import { TEACHER_SESSION_MAX_AGE_SECONDS } from './shared/auth.ts'

const require = createRequire(import.meta.url)

export default defineNuxtConfig({
  compatibilityDate: '2026-10-11',
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  telemetry: false,
  nitro: {
    errorHandler: './server/error-handler.ts',
    // Node 24 supports native import.meta. Nitro's es2019 transform otherwise
    // erases the parser's module-local resolver; client targets stay unchanged.
    esbuild: { options: { supported: { 'import-meta': true } } },
    externals: {
      external: ['exceljs', 'yauzl', 'saxes'],
      // Give Nitro real entry files: external package names can stay unresolved
      // and reach node-file-trace as paths relative to the build directory.
      traceInclude: ['exceljs', 'yauzl', 'saxes'].map(name => require.resolve(name)),
    },
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
