<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const email = ref('')
const password = ref('')
const fieldErrors = reactive({ email: '', password: '' })
const formError = ref('')
const isSubmitting = ref(false)

function clearErrors() {
  fieldErrors.email = ''
  fieldErrors.password = ''
  formError.value = ''
}

function focusFirstInvalidField() {
  nextTick(() => {
    const target = fieldErrors.email ? 'email' : fieldErrors.password ? 'password' : null
    if (target) document.getElementById(target)?.focus()
  })
}

async function submitLogin() {
  clearErrors()
  if (!email.value.trim()) fieldErrors.email = 'Masukkan alamat email.'
  if (!password.value) fieldErrors.password = 'Masukkan kata sandi.'
  if (fieldErrors.email || fieldErrors.password) {
    focusFirstInvalidField()
    return
  }

  isSubmitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value.trim(), password: password.value },
    })
    await navigateTo('/')
  } catch (error: unknown) {
    const response = error as { data?: { message?: string; fieldErrors?: { email?: string; password?: string } } }
    fieldErrors.email = response.data?.fieldErrors?.email ?? ''
    fieldErrors.password = response.data?.fieldErrors?.password ?? ''
    formError.value = response.data?.message ?? 'Email atau kata sandi belum cocok.'
    focusFirstInvalidField()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-story" aria-label="Tentang Absensi Siswa">
      <a class="brand" href="/" aria-label="Absensi Siswa">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 4.75h5.4A2.6 2.6 0 0 1 13 7.35v12.1a3.1 3.1 0 0 0-2.6-1.4H5a1 1 0 0 1-1-1v-11a1.3 1.3 0 0 1 1-1.3Zm14 0h-5.4A2.6 2.6 0 0 0 11 7.35v12.1a3.1 3.1 0 0 1 2.6-1.4H19a1 1 0 0 0 1-1v-11a1.3 1.3 0 0 0-1-1.3Z" />
          </svg>
        </span>
        <span>Absensi Siswa</span>
      </a>

      <div class="story-copy">
        <h1>Catat kehadiran kelas setiap hari.</h1>
        <p>Buka tanggal, isi absensi, lalu simpan.</p>
        <div class="attendance-preview" aria-hidden="true">
          <h2>Absensi harian</h2>
          <div class="preview-row"><span class="preview-square" /><span class="preview-line" /><span>Hadir</span></div>
          <div class="preview-row"><span class="preview-square" /><span class="preview-line" /><span>Sakit</span></div>
          <div class="preview-row"><span class="preview-square" /><span class="preview-line" /><span>Izin</span></div>
        </div>
      </div>
    </section>

    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-card">
        <h1 id="login-title">Masuk</h1>
        <p v-if="route.query.passwordChanged === '1'" role="status">Kata sandi tersimpan. Masuk dengan kata sandi baru.</p>
        <p class="login-intro">Gunakan akun guru untuk mengisi absensi kelas.</p>

        <form class="login-form" novalidate @submit.prevent="submitLogin">
          <div class="form-field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="username"
              inputmode="email"
              required
              aria-required="true"
              :aria-invalid="Boolean(fieldErrors.email)"
              :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
              :disabled="isSubmitting"
            >
            <p v-if="fieldErrors.email" id="email-error" class="field-error">{{ fieldErrors.email }}</p>
          </div>

          <div class="form-field">
            <label for="password">Kata sandi</label>
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              aria-required="true"
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
              :disabled="isSubmitting"
            >
            <p v-if="fieldErrors.password" id="password-error" class="field-error">{{ fieldErrors.password }}</p>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <button class="primary-button" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Sedang masuk…' : 'Masuk' }}
          </button>
        </form>
      </div>
    </section>
  </main>
</template>
