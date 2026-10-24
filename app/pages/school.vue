<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'

interface SchoolResponse {
  school: { principalName: string; principalNip: string; teacherName: string; teacherNip: string; id: string; name: string; className: string; timeZone: string; logoAssetId: string | null } | null
}

const requestFetch = useRequestFetch()
const initial = await requestFetch<SchoolResponse>('/api/school').catch(() => null)
const form = reactive({
  principalName: initial?.school?.principalName ?? '',
  principalNip: initial?.school?.principalNip ?? '',
  teacherName: initial?.school?.teacherName ?? '',
  teacherNip: initial?.school?.teacherNip ?? '',

  name: initial?.school?.name ?? '',
  className: initial?.school?.className ?? '',
  timeZone: initial?.school?.timeZone ?? 'Asia/Jakarta',
})
const hasLoaded = ref(initial !== null)
const isConfigured = ref(Boolean(initial?.school))
const isSaving = ref(false)
const isClientReady = ref(false)
const pageError = ref(initial === null ? 'Data sekolah belum dapat dimuat. Coba muat ulang halaman.' : '')
const successMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const logoAssetId = ref(initial?.school?.logoAssetId ?? null)
const logoAction = ref<'keep' | 'replace' | 'clear'>('keep')
const selectedLogo = ref<File | null>(null)
const selectedLogoPreview = ref('')
const selectedLogoPreviewUnavailable = ref(false)
const logoImageUnavailable = ref(false)
const logoFileInput = ref<HTMLInputElement | null>(null)
const logoError = computed(() => fieldErrors.value.logo ?? '')
const displayedLogoUrl = computed(() => {
  if (logoAction.value === 'clear') return ''
  if (selectedLogoPreview.value && !selectedLogoPreviewUnavailable.value) return selectedLogoPreview.value
  if (logoAssetId.value && !logoImageUnavailable.value) return `/api/school/logo/${encodeURIComponent(logoAssetId.value)}`
  return ''
})

async function saveSchool() {
  if (!isClientReady.value || isSaving.value) return
  pageError.value = ''
  successMessage.value = ''
  fieldErrors.value = {}
  for (const key of ['principalName','principalNip','teacherName','teacherNip'] as const) {
    if (Array.from(form[key].trim()).length > (key.endsWith('Nip') ? 50 : 200)) fieldErrors.value[key] = 'Identitas tidak valid atau terlalu panjang.'
  }
  if (Object.keys(fieldErrors.value).length) { nextTick(() => document.getElementById(Object.keys(fieldErrors.value)[0]!)?.focus()); return }
  isSaving.value = true
  try {
    const metadata = {
      principalName: form.principalName,
      principalNip: form.principalNip,
      teacherName: form.teacherName,
      teacherNip: form.teacherNip,
      name: form.name,
      className: form.className,
      timeZone: form.timeZone,
      logoAction: logoAction.value,
    }
    const body = logoAction.value === 'keep'
      ? metadata
      : createLogoFormData(metadata, selectedLogo.value)
    const result = await $fetch<{ ok: boolean; school: SchoolResponse['school'] }>('/api/school', {
      method: 'PUT',
      body,
    })
    isConfigured.value = true
    if (result.school) {
      form.principalName = result.school.principalName
      form.principalNip = result.school.principalNip
      form.teacherName = result.school.teacherName
      form.teacherNip = result.school.teacherNip
      form.name = result.school.name
      form.className = result.school.className
      form.timeZone = result.school.timeZone
      logoAssetId.value = result.school.logoAssetId
    }
    clearSelectedLogo()
    logoAction.value = 'keep'
    logoImageUnavailable.value = false
    successMessage.value = metadata.logoAction === 'clear'
      ? 'Logo sekolah dihapus. Data sekolah tersimpan.'
      : metadata.logoAction === 'replace'
        ? 'Data sekolah dan logo tersimpan.'
        : 'Data sekolah tersimpan.'
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    nextTick(() => document.getElementById(Object.keys(fieldErrors.value)[0] ?? '')?.focus())
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
  form.principalName = result.school?.principalName ?? ''
  form.principalNip = result.school?.principalNip ?? ''
  form.teacherName = result.school?.teacherName ?? ''
  form.teacherNip = result.school?.teacherNip ?? ''
  form.name = result.school?.name ?? ''
  form.className = result.school?.className ?? ''
  form.timeZone = result.school?.timeZone ?? 'Asia/Jakarta'
  logoAssetId.value = result.school?.logoAssetId ?? null
  logoImageUnavailable.value = false
}

function createLogoFormData(metadata: Record<string, string>, file: File | null): FormData {
  const body = new FormData()
  body.append('metadata', JSON.stringify(metadata))
  if (metadata.logoAction === 'replace' && file) body.append('logo', file, file.name)
  return body
}

function chooseLogo() {
  logoFileInput.value?.click()
}

function handleLogoSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedLogo.value = file
  revokeSelectedLogoPreview()
  selectedLogoPreviewUnavailable.value = false
  selectedLogoPreview.value = URL.createObjectURL(file)
  logoAction.value = 'replace'
  logoImageUnavailable.value = false
  delete fieldErrors.value.logo
  pageError.value = ''
  successMessage.value = ''
}

function clearLogo() {
  clearSelectedLogo()
  logoAction.value = 'clear'
  logoImageUnavailable.value = false
  delete fieldErrors.value.logo
  pageError.value = ''
  successMessage.value = ''
}

function clearSelectedLogo() {
  selectedLogo.value = null
  selectedLogoPreviewUnavailable.value = false
  revokeSelectedLogoPreview()
  if (logoFileInput.value) logoFileInput.value.value = ''
}

function revokeSelectedLogoPreview() {
  if (!selectedLogoPreview.value) return
  URL.revokeObjectURL(selectedLogoPreview.value)
  selectedLogoPreview.value = ''
}

function handleLogoImageError() {
  if (selectedLogoPreview.value) selectedLogoPreviewUnavailable.value = true
  else logoImageUnavailable.value = true
}

onMounted(() => { isClientReady.value = true })
onBeforeUnmount(revokeSelectedLogoPreview)
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

      <div class="form-field"><label for="principalName">Nama kepala sekolah</label><input id="principalName" v-model="form.principalName" type="text" :disabled="isSaving || !isClientReady" :aria-invalid="Boolean(fieldErrors.principalName)" :aria-describedby="fieldErrors.principalName ? 'principalName-error' : undefined"><p v-if="fieldErrors.principalName" id="principalName-error" class="field-error">{{ fieldErrors.principalName }}</p></div>
<div class="form-field"><label for="principalNip">NIP kepala sekolah</label><input id="principalNip" v-model="form.principalNip" type="text" :disabled="isSaving || !isClientReady" :aria-invalid="Boolean(fieldErrors.principalNip)" :aria-describedby="fieldErrors.principalNip ? 'principalNip-error' : undefined"><p v-if="fieldErrors.principalNip" id="principalNip-error" class="field-error">{{ fieldErrors.principalNip }}</p></div>
<div class="form-field"><label for="teacherName">Nama guru</label><input id="teacherName" v-model="form.teacherName" type="text" :disabled="isSaving || !isClientReady" :aria-invalid="Boolean(fieldErrors.teacherName)" :aria-describedby="fieldErrors.teacherName ? 'teacherName-error' : undefined"><p v-if="fieldErrors.teacherName" id="teacherName-error" class="field-error">{{ fieldErrors.teacherName }}</p></div>
<div class="form-field"><label for="teacherNip">NIP guru</label><input id="teacherNip" v-model="form.teacherNip" type="text" :disabled="isSaving || !isClientReady" :aria-invalid="Boolean(fieldErrors.teacherNip)" :aria-describedby="fieldErrors.teacherNip ? 'teacherNip-error' : undefined"><p v-if="fieldErrors.teacherNip" id="teacherNip-error" class="field-error">{{ fieldErrors.teacherNip }}</p></div>
<div class="form-field">
        <label for="school-name">Nama sekolah <span aria-hidden="true">*</span></label>
        <input
          id="school-name"
          v-model="form.name"
          autocomplete="organization"
          maxlength="120"
          required
          :disabled="isSaving || !isClientReady"
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
          :disabled="isSaving || !isClientReady"
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
          :disabled="isSaving || !isClientReady"
          :aria-invalid="Boolean(fieldErrors.timeZone)"
          :aria-describedby="fieldErrors.timeZone ? 'school-time-zone-error' : 'school-time-zone-help'"
        >
        <p v-if="fieldErrors.timeZone" id="school-time-zone-error" class="field-error">{{ fieldErrors.timeZone }}</p>
        <p v-else id="school-time-zone-help" class="field-help">Contoh: Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura.</p>
      </div>

      <div class="school-logo-card">
        <div class="school-logo-preview" aria-hidden="true">
          <img
            v-if="displayedLogoUrl"
            :key="displayedLogoUrl"
            :src="displayedLogoUrl"
            alt=""
            @error="handleLogoImageError"
          >
          <span v-else class="logo-placeholder-mark">S</span>
        </div>
        <div class="school-logo-copy">
          <strong>Logo sekolah</strong>
          <small v-if="logoAction === 'clear'">Logo akan dilepas saat perubahan disimpan.</small>
          <small v-else-if="selectedLogo && selectedLogoPreviewUnavailable">Pratinjau tidak tersedia. Pilihan tetap menunggu disimpan.</small>
          <small v-else-if="selectedLogo">Pilihan baru belum disimpan.</small>
          <small v-else-if="logoAssetId && !logoImageUnavailable">Logo tersimpan.</small>
          <small v-else-if="logoAssetId">Logo belum dapat ditampilkan di lingkungan ini.</small>
          <small v-else>Belum ada logo.</small>
          <div class="school-logo-actions">
            <button class="secondary-button" type="button" :disabled="isSaving || !isClientReady" @click="chooseLogo">Pilih logo</button>
            <button class="text-button" type="button" :disabled="isSaving || !isClientReady" @click="clearLogo">Hapus logo</button>
          </div>
          <p class="field-help">PNG atau JPEG, maksimal 2 MB dan 4096 × 4096 piksel.</p>
          <p v-if="logoError" class="field-error" role="alert">{{ logoError }}</p>
        </div>
        <input
          ref="logoFileInput"
          class="visually-hidden"
          type="file"
          accept="image/png,image/jpeg"
          tabindex="-1"
          aria-label="Pilih logo sekolah"
          :disabled="isSaving || !isClientReady"
          @change="handleLogoSelection"
        >
      </div>

      <button class="primary-button form-submit" type="submit" :disabled="isSaving || !isClientReady">
        {{ isSaving ? 'Menyimpan…' : isConfigured ? 'Simpan perubahan' : 'Simpan data sekolah' }}
      </button>
    </form>
  </main>
</template>
