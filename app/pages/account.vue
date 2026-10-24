<script setup lang="ts">
import { passwordErrors, passwordFields } from '#shared/password'
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'
const requestFetch = useRequestFetch()
const session = await requestFetch<{email?:string}>('/api/auth/session')
const form = reactive({currentPassword:'',newPassword:'',confirmation:''})
const errors = ref<Record<string,string>>({})
const message = ref('')
const saving = ref(false)
const labels = {currentPassword:'Kata sandi saat ini',newPassword:'Kata sandi baru',confirmation:'Konfirmasi kata sandi baru'}
function focusError() { nextTick(() => document.getElementById(passwordFields.find(key => errors.value[key]) ?? '')?.focus()) }
async function save() {
  if (saving.value) return
  message.value = ''
  errors.value = passwordErrors(form)
  if (Object.keys(errors.value).length) { focusError(); return }
  saving.value = true
  try {
    await $fetch('/api/account/password',{method:'POST',body:{...form}})
    for (const field of passwordFields) form[field] = ''
    await navigateTo('/login?passwordChanged=1')
  } catch(error) { errors.value = getApiFieldErrors(error); message.value = getApiMessage(error,'Kata sandi belum tersimpan. Coba lagi.'); focusError() }
  finally { saving.value = false }
}
</script>
<template>
  <main class="page-content account-page">
    <section class="page-heading"><h1>Akun</h1><p>Perbarui kata sandi akun guru.</p></section>
    <form class="content-card account-form" novalidate @submit.prevent="save">
      <div class="form-field"><label for="account-email">Email</label><input id="account-email" :value="session.email" type="email" readonly autocomplete="username"></div>
      <div v-for="field in passwordFields" :key="field" class="form-field">
        <label :for="field">{{ labels[field] }}</label>
        <input :id="field" v-model="form[field]" type="password" :autocomplete="field === 'currentPassword' ? 'current-password' : 'new-password'" :disabled="saving" :aria-invalid="Boolean(errors[field])" :aria-describedby="errors[field] ? `${field}-error` : undefined">
        <p v-if="errors[field]" :id="`${field}-error`" class="field-error">{{ errors[field] }}</p>
      </div>
      <p class="account-hint">Gunakan 12 sampai 1024 karakter. Setelah disimpan, Anda akan keluar dari semua perangkat dan perlu masuk dengan kata sandi baru.</p>
      <p v-if="message" class="form-error" role="alert">{{ message }}</p>
      <div class="account-buttons"><NuxtLink v-if="!saving" to="/" class="secondary-button">Batal</NuxtLink><span v-else class="secondary-button" aria-disabled="true">Batal</span><button class="primary-button" type="submit" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button></div>
    </form>
  </main>
</template>
<style scoped>
.account-page { max-width: 760px; }
.account-form { display: grid; gap: 20px; padding: 24px; }
.account-form input { width: 100%; box-sizing: border-box; min-height: 46px; }
.account-hint { color: #536b65; line-height: 1.5; margin: 0; }
.account-buttons { display: flex; justify-content: flex-end; gap: 12px; }
.account-buttons a { display: inline-flex; align-items: center; text-decoration: none; }
@media(max-width:600px) { .account-form { padding: 18px; } .account-buttons > * { flex: 1; justify-content: center; } }
</style>
