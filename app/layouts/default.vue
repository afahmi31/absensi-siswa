<script setup lang="ts">
interface SessionResponse {
  authenticated: boolean
  email?: string
}

const requestFetch = useRequestFetch()
const { email } = await requestFetch<SessionResponse>('/api/auth/session')
const route = useRoute()
const isLoggingOut = ref(false)
const logoutError = ref('')

async function logout() {
  logoutError.value = ''
  isLoggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } catch {
    logoutError.value = 'Keluar belum berhasil. Coba lagi.'
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <NuxtLink class="brand" to="/" aria-label="Beranda Absensi Siswa">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 4.75h5.4A2.6 2.6 0 0 1 13 7.35v12.1a3.1 3.1 0 0 0-2.6-1.4H5a1 1 0 0 1-1-1v-11a1.3 1.3 0 0 1 1-1.3Zm14 0h-5.4A2.6 2.6 0 0 0 11 7.35v12.1a3.1 3.1 0 0 1 2.6-1.4H19a1 1 0 0 0 1-1v-11a1.3 1.3 0 0 0-1-1.3Z" />
          </svg>
        </span>
        <span>Absensi Siswa</span>
      </NuxtLink>

      <nav class="main-nav" aria-label="Navigasi utama">
        <NuxtLink to="/school" :aria-current="route.path === '/school' ? 'page' : undefined">Sekolah</NuxtLink>
        <NuxtLink to="/students" :aria-current="route.path === '/students' ? 'page' : undefined">Siswa</NuxtLink>
        <NuxtLink to="/semesters" :aria-current="route.path === '/semesters' ? 'page' : undefined">Semester</NuxtLink>
        <NuxtLink to="/calendar" :aria-current="route.path === '/calendar' ? 'page' : undefined">Kalender</NuxtLink>
        <NuxtLink to="/attendance" :aria-current="route.path === '/attendance' ? 'page' : undefined">Absensi</NuxtLink>
      </nav>

      <div class="account-actions">
        <span class="account-email">{{ email }}</span>
        <button class="secondary-button" type="button" :disabled="isLoggingOut" @click="logout">
          {{ isLoggingOut ? 'Sedang keluar…' : 'Keluar' }}
        </button>
      </div>
      <p v-if="logoutError" class="header-error" role="alert">{{ logoutError }}</p>
    </header>

    <slot />
  </div>
</template>
