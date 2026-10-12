export default defineNuxtConfig({
  compatibilityDate: '2026-10-11',
  devtools: { enabled: false },
  telemetry: false,
  nitro: {
    // Nitro 2.13.4 auto-detection caps Node at 22; this project targets Node 24.
    vercel: { functions: { runtime: 'nodejs24.x' } },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Website Absensi Siswa',
      meta: [{ name: 'description', content: 'Website Absensi Siswa sedang disiapkan.' }],
    },
  },
  runtimeConfig: {
    // Reserved for a future server-side database contract; not used in this task.
    databaseUrl: '',
    supabaseUrl: '',
  },
})
