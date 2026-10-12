<script setup lang="ts">
interface AuthSessionResponse {
  authenticated: boolean
  email?: string
}

const requestFetch = useRequestFetch()
const { email } = await requestFetch<AuthSessionResponse>('/api/auth/session')
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
  <main class="home-shell">
    <header class="home-header">
      <a class="brand" href="/" aria-label="Absensi Siswa">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 4.75h5.4A2.6 2.6 0 0 1 13 7.35v12.1a3.1 3.1 0 0 0-2.6-1.4H5a1 1 0 0 1-1-1v-11a1.3 1.3 0 0 1 1-1.3Zm14 0h-5.4A2.6 2.6 0 0 0 11 7.35v12.1a3.1 3.1 0 0 1 2.6-1.4H19a1 1 0 0 0 1-1v-11a1.3 1.3 0 0 0-1-1.3Z" />
          </svg>
        </span>
        <span>Absensi Siswa</span>
      </a>
      <div class="account-actions">
        <span class="account-email">{{ email }}</span>
        <button class="secondary-button" type="button" :disabled="isLoggingOut" @click="logout">
          {{ isLoggingOut ? 'Sedang keluar…' : 'Keluar' }}
        </button>
      </div>
    </header>

    <section class="empty-home" aria-labelledby="home-title">
      <h1 id="home-title">Absensi kelas</h1>
      <p>Pengisian absensi belum tersedia.</p>
      <p v-if="logoutError" class="form-error" role="alert">{{ logoutError }}</p>
    </section>
  </main>
</template>
