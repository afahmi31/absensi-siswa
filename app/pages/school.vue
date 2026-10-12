<script setup lang="ts">
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'

interface SchoolResponse {
  school: { id: string; name: string; className: string; timeZone: string } | null
}

const requestFetch = useRequestFetch()
const initial = await requestFetch<SchoolResponse>('/api/school').catch(() => null)
const form = reactive({
  name: initial?.school?.name ?? '',
  className: initial?.school?.className ?? '',
  timeZone: initial?.school?.timeZone ?? 'Asia/Jakarta',
})
const hasLoaded = ref(initial !== null)
const isConfigured = ref(Boolean(initial?.school))
const isSaving = ref(false)
const pageError = ref(initial === null ? 'Data sekolah belum dapat dimuat. Coba muat ulang halaman.' : '')
const successMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})

async function saveSchool() {
  pageError.value = ''
  successMessage.value = ''
  fieldErrors.value = {}
  isSaving.value = true
  try {
    const result = await $fetch<{ ok: boolean; school: SchoolResponse['school'] }>('/api/school', {
      method: 'PUT',
      body: { name: form.name, className: form.className, timeZone: form.timeZone },
    })
    isConfigured.value = true
    if (result.school) {
      form.name = result.school.name
      form.className = result.school.className
      form.timeZone = result.school.timeZone
    }
    successMessage.value = 'Data sekolah tersimpan.'
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    pageError.value = getApiMessage(error, 'Data sekolah belum tersimpan. Periksa kembali isian lalu coba lagi.')
  } finally {
    isSaving.value = false
  }
}

async function reloadSchool() {
  pageError.value = ''
  const result = await requestFetch<SchoolResponse>('/api/school').catch(() => null)
  if (!result) {
    pageError.value = 'Data sekolah belum dapat dimuat. Coba lagi.'
    return
  }
  hasLoaded.value = true
  isConfigured.value = Boolean(result.school)
  form.name = result.school?.name ?? ''
  form.className = result.school?.className ?? ''
  form.timeZone = result.school?.timeZone ?? 'Asia/Jakarta'
}
</script>

<template>
  <main class="page-content">
    <section class="page-heading">
      <p class="eyebrow">Pengaturan dasar</p>
      <h1>Data sekolah</h1>
      <p>Simpan satu sekolah dan satu kelas untuk akun ini. Zona waktu digunakan untuk tanggal sekolah.</p>
    </section>

    <p v-if="pageError" class="form-error page-message" role="alert">
      {{ pageError }}
      <button v-if="!hasLoaded" class="text-button" type="button" @click="reloadSchool">Coba lagi</button>
    </p>
    <p v-if="successMessage" class="success-message page-message" role="status">{{ successMessage }}</p>

    <form v-if="hasLoaded" class="content-card school-form" @submit.prevent="saveSchool">
      <div class="form-section-heading">
        <div>
          <h2>{{ isConfigured ? 'Informasi sekolah' : 'Siapkan sekolah' }}</h2>
          <p>Nama dan kelas dapat diperbarui nanti.</p>
        </div>
        <span class="single-school-badge">Satu sekolah, satu kelas</span>
      </div>

      <div class="form-field">
        <label for="school-name">Nama sekolah <span aria-hidden="true">*</span></label>
        <input
          id="school-name"
          v-model="form.name"
          autocomplete="organization"
          maxlength="120"
          required
          :disabled="isSaving"
          :aria-invalid="Boolean(fieldErrors.name)"
          :aria-describedby="fieldErrors.name ? 'school-name-error' : undefined"
        >
        <p v-if="fieldErrors.name" id="school-name-error" class="field-error">{{ fieldErrors.name }}</p>
      </div>

      <div class="form-field">
        <label for="class-name">Nama kelas <span aria-hidden="true">*</span></label>
        <input
          id="class-name"
          v-model="form.className"
          maxlength="80"
          placeholder="Contoh: Kelas 1A"
          required
          :disabled="isSaving"
          :aria-invalid="Boolean(fieldErrors.className)"
          :aria-describedby="fieldErrors.className ? 'class-name-error' : undefined"
        >
        <p v-if="fieldErrors.className" id="class-name-error" class="field-error">{{ fieldErrors.className }}</p>
      </div>

      <div class="form-field">
        <label for="school-time-zone">Zona waktu sekolah <span aria-hidden="true">*</span></label>
        <input
          id="school-time-zone"
          v-model="form.timeZone"
          autocomplete="off"
          maxlength="100"
          placeholder="Asia/Jakarta"
          required
          :disabled="isSaving"
          :aria-invalid="Boolean(fieldErrors.timeZone)"
          :aria-describedby="fieldErrors.timeZone ? 'school-time-zone-error' : 'school-time-zone-help'"
        >
        <p v-if="fieldErrors.timeZone" id="school-time-zone-error" class="field-error">{{ fieldErrors.timeZone }}</p>
        <p v-else id="school-time-zone-help" class="field-help">Contoh: Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura.</p>
      </div>

      <div class="logo-placeholder" aria-label="Pengaturan logo belum tersedia">
        <span class="logo-placeholder-mark" aria-hidden="true">S</span>
        <span><strong>Logo sekolah</strong><small>Pengaturan logo belum tersedia.</small></span>
      </div>

      <button class="primary-button form-submit" type="submit" :disabled="isSaving">
        {{ isSaving ? 'Menyimpan…' : isConfigured ? 'Simpan perubahan' : 'Simpan data sekolah' }}
      </button>
    </form>
  </main>
</template>
