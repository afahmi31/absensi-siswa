<script setup lang="ts">
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'

interface SemesterRecord {
  id: string
  academicYear: string
  term: 'ganjil' | 'genap'
  startsOn: string
  endsOn: string
  status: 'active' | 'closed'
  schoolName: string
  className: string
  studentsAtEnd: number
}

interface SemesterListResponse {
  semesters: SemesterRecord[]
}

interface ClosurePreview {
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active' | 'closed'
    schoolName: string
    className: string
  }
  calendarConfigured: boolean
  schoolDayCount: number | null
  eligibleCellCount: number | null
  filledCellCount: number | null
  blankCellCount: number | null
  incompleteSchoolDayCount: number | null
  previewToken: string
}

interface SchoolResponse {
  school: { name: string; className: string } | null
}

const requestFetch = useRequestFetch()
const [initialList, initialSchool] = await Promise.all([
  requestFetch<SemesterListResponse>('/api/semesters').catch(() => null),
  requestFetch<SchoolResponse>('/api/school').catch(() => null),
])

const semesters = ref(initialList?.semesters ?? [])
const school = ref(initialSchool?.school ?? null)
const hasLoaded = ref(initialList !== null)
const isLoading = ref(false)
const pageError = ref(initialList ? '' : 'Daftar semester belum dapat dimuat. Coba lagi.')
const successMessage = ref('')
const isFormOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const isSaving = ref(false)
const formError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const formSemesterId = ref('')
const rosterSource = ref<'previous' | 'empty'>('previous')
const form = reactive({ academicYear: '', term: 'ganjil' as 'ganjil' | 'genap', startsOn: '', endsOn: '' })
const isClosureOpen = ref(false)
const isLoadingPreview = ref(false)
const isClosing = ref(false)
const closureError = ref('')
const previewChanged = ref(false)
const closurePreview = ref<ClosurePreview | null>(null)

const activeSemester = computed(() => semesters.value.find((semester) => semester.status === 'active') ?? null)
const latestClosedSemester = computed(() => semesters.value
  .filter((semester) => semester.status === 'closed')
  .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0] ?? null)
const availablePreviousSemester = computed(() => semesters.value
  .filter((semester) => semester.status === 'closed' && (!form.startsOn || semester.endsOn < form.startsOn))
  .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0] ?? null)

function termLabel(term: 'ganjil' | 'genap'): string {
  return term === 'ganjil' ? 'Ganjil' : 'Genap'
}

function semesterLabel(semester: SemesterRecord): string {
  return `${termLabel(semester.term)} ${semester.academicYear}`
}

function formatDate(date: string): string {
  const [year = 1, month = 1, day = 1] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function getNextSemesterDefaults(previous: SemesterRecord | null) {
  if (!previous) return { academicYear: '', term: 'ganjil' as const }
  if (previous.term === 'ganjil') return { academicYear: previous.academicYear, term: 'genap' as const }
  const [firstYear = 0, secondYear = 0] = previous.academicYear.split('/').map(Number)
  return { academicYear: `${firstYear + 1}/${secondYear + 1}`, term: 'ganjil' as const }
}

function clearFormMessages() {
  formError.value = ''
  fieldErrors.value = {}
  successMessage.value = ''
}

function openCreateForm() {
  const defaults = getNextSemesterDefaults(semesters.value.find((semester) => semester.status === 'closed') ?? null)
  formMode.value = 'create'
  formSemesterId.value = ''
  form.academicYear = defaults.academicYear
  form.term = defaults.term
  form.startsOn = ''
  form.endsOn = ''
  rosterSource.value = availablePreviousSemester.value ? 'previous' : 'empty'
  clearFormMessages()
  isFormOpen.value = true
}

function openEditForm(semester: SemesterRecord) {
  formMode.value = 'edit'
  formSemesterId.value = semester.id
  form.academicYear = semester.academicYear
  form.term = semester.term
  form.startsOn = semester.startsOn
  form.endsOn = semester.endsOn
  clearFormMessages()
  isFormOpen.value = true
}

function closeForm() {
  isFormOpen.value = false
  clearFormMessages()
}

async function reloadData() {
  pageError.value = ''
  isLoading.value = true
  const [listResult, schoolResult] = await Promise.all([
    requestFetch<SemesterListResponse>('/api/semesters').catch(() => null),
    requestFetch<SchoolResponse>('/api/school').catch(() => null),
  ])
  isLoading.value = false
  if (!listResult) {
    pageError.value = 'Daftar semester belum dapat dimuat. Coba lagi.'
    return false
  }
  hasLoaded.value = true
  semesters.value = listResult.semesters
  if (schoolResult) school.value = schoolResult.school
  return true
}

async function saveSemester() {
  if (isSaving.value) return
  clearFormMessages()
  isSaving.value = true
  try {
    if (formMode.value === 'edit') {
      await $fetch(`/api/semesters/${encodeURIComponent(formSemesterId.value)}`, {
        method: 'PATCH',
        body: {
          academicYear: form.academicYear,
          term: form.term,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
        },
      })
    } else {
      await $fetch('/api/semesters', {
        method: 'POST',
        body: {
          academicYear: form.academicYear,
          term: form.term,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
          rosterSource: rosterSource.value,
        },
      })
    }
    isFormOpen.value = false
    successMessage.value = formMode.value === 'edit' ? 'Perubahan semester tersimpan.' : 'Semester baru dibuat.'
    await reloadData()
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    formError.value = getApiMessage(error, 'Semester belum tersimpan. Periksa isian lalu coba lagi.')
  } finally {
    isSaving.value = false
  }
}

async function loadClosurePreview(semesterId: string) {
  isLoadingPreview.value = true
  closureError.value = ''
  previewChanged.value = false
  closurePreview.value = null
  try {
    const result = await $fetch<{ preview: ClosurePreview }>(`/api/semesters/${encodeURIComponent(semesterId)}/closure-preview`)
    closurePreview.value = result.preview
  } catch (error) {
    closureError.value = getApiMessage(error, 'Kelengkapan semester belum dapat diperiksa. Coba lagi.')
  } finally {
    isLoadingPreview.value = false
  }
}

async function openClosure(semester: SemesterRecord) {
  isClosureOpen.value = true
  await loadClosurePreview(semester.id)
}

function closeClosure() {
  if (isClosing.value) return
  isClosureOpen.value = false
  closurePreview.value = null
  closureError.value = ''
  previewChanged.value = false
}

function readFreshPreview(error: unknown): ClosurePreview | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null
  const outer = (error as { data?: unknown }).data
  if (typeof outer !== 'object' || outer === null || !('data' in outer)) return null
  const responseData = (outer as { data?: unknown }).data
  if (typeof responseData !== 'object' || responseData === null || !('preview' in responseData)) return null
  const candidate = (responseData as { preview?: unknown }).preview
  if (typeof candidate !== 'object' || candidate === null || !('previewToken' in candidate) || !('semester' in candidate)) return null
  return candidate as ClosurePreview
}

async function confirmClosure() {
  const preview = closurePreview.value
  if (!preview || isClosing.value) return
  isClosing.value = true
  closureError.value = ''
  try {
    await $fetch(`/api/semesters/${encodeURIComponent(preview.semester.id)}/close`, {
      method: 'POST',
      body: { previewToken: preview.previewToken, confirmed: true },
    })
    isClosureOpen.value = false
    successMessage.value = `${semesterLabel({ ...preview.semester, studentsAtEnd: 0 })} ditutup dan disimpan sebagai arsip.`
    await reloadData()
  } catch (error) {
    const freshPreview = readFreshPreview(error)
    if (freshPreview) {
      closurePreview.value = freshPreview
      previewChanged.value = true
    }
    closureError.value = getApiMessage(error, 'Semester belum dapat ditutup. Coba lagi.')
  } finally {
    isClosing.value = false
  }
}
</script>

<template>
  <main class="page-content semesters-page">
    <section class="page-heading semester-heading">
      <div>
        <p class="eyebrow">Pengelolaan kelas</p>
        <h1>Semester</h1>
        <p v-if="school">{{ school.name }} · {{ school.className || 'Kelas belum disiapkan' }}</p>
        <p v-else>Atur periode belajar, periksa kelengkapan absensi, lalu simpan semester sebagai arsip.</p>
      </div>
      <button
        v-if="hasLoaded && !activeSemester && !isFormOpen"
        class="primary-button semester-create-button"
        type="button"
        @click="openCreateForm"
      >
        ＋ Buat semester baru
      </button>
    </section>

    <p v-if="pageError" class="form-error page-message" role="alert">
      {{ pageError }}
      <button class="text-button" type="button" @click="reloadData">Coba lagi</button>
    </p>
    <p v-if="successMessage" class="success-message page-message" role="status">{{ successMessage }}</p>

    <section v-if="!hasLoaded && !pageError" class="content-card empty-state" role="status">
      <p>Memuat semester…</p>
    </section>

    <section v-else-if="hasLoaded && semesters.length === 0" class="content-card empty-state" aria-labelledby="no-semester-title">
      <span class="empty-state-icon" aria-hidden="true">▤</span>
      <h2 id="no-semester-title">Belum ada semester</h2>
      <p>Buat semester setelah data sekolah dan kelas siap. Tahun ajaran memakai dua tahun berurutan.</p>
      <NuxtLink class="text-button semester-setup-link" to="/school">Periksa data sekolah</NuxtLink>
      <button class="primary-button empty-create-button" type="button" @click="openCreateForm">Buat semester</button>
    </section>

    <section v-if="semesters.length" class="semester-list" aria-label="Daftar semester">
      <article v-for="semester in semesters" :key="semester.id" class="content-card semester-card" :class="{ 'semester-card-active': semester.status === 'active' }">
        <div class="semester-card-copy">
          <div class="semester-card-title-row">
            <h2>{{ semesterLabel(semester) }}</h2>
            <span v-if="semester.status === 'active'" class="active-badge">Aktif · belum ditutup</span>
            <span v-else class="archive-badge">Ditutup · arsip</span>
          </div>
          <p class="semester-date-range">{{ formatDate(semester.startsOn) }} — {{ formatDate(semester.endsOn) }}</p>
          <p v-if="semester.status === 'closed'" class="semester-archive-note">
            {{ semester.studentsAtEnd }} siswa masih terdaftar pada akhir semester. Data arsip hanya dapat dilihat.
          </p>
          <p v-else class="semester-active-note">Periksa absensi sebelum menutup. Tanggal yang masih kosong tetap kosong.</p>
        </div>
        <div v-if="semester.status === 'active'" class="semester-card-actions">
          <button class="secondary-button" type="button" :disabled="isFormOpen || isLoading" @click="openEditForm(semester)">Ubah periode</button>
          <button class="close-semester-button" type="button" :disabled="isFormOpen || isLoading" @click="openClosure(semester)">Tutup semester</button>
        </div>
        <div v-else-if="!activeSemester && semester.id === latestClosedSemester?.id" class="semester-card-actions">
          <button class="text-button" type="button" :disabled="isFormOpen || isLoading" @click="openCreateForm">Buat semester baru</button>
        </div>
      </article>
    </section>

    <section v-if="isFormOpen" class="content-card semester-form-card" aria-labelledby="semester-form-title">
      <div class="form-section-heading">
        <div>
          <p class="eyebrow">{{ formMode === 'edit' ? 'Semester aktif' : 'Periode belajar' }}</p>
          <h2 id="semester-form-title">{{ formMode === 'edit' ? 'Ubah periode semester' : 'Buat semester' }}</h2>
          <p v-if="formMode === 'edit'">Periode harus tetap mencakup semua masa terdaftar dan catatan absensi.</p>
          <p v-else>Periode mulai dan selesai sama-sama termasuk dalam semester.</p>
        </div>
        <button class="text-button close-form-button" type="button" :disabled="isSaving" @click="closeForm">Tutup</button>
      </div>

      <p v-if="formError" class="form-error page-message" role="alert">{{ formError }}</p>

      <form class="semester-form" @submit.prevent="saveSemester">
        <div class="semester-form-grid">
          <div class="form-field">
            <label for="semester-academic-year">Tahun ajaran <span aria-hidden="true">*</span></label>
            <input
              id="semester-academic-year"
              v-model="form.academicYear"
              inputmode="numeric"
              autocomplete="off"
              maxlength="9"
              placeholder="2026/2027"
              required
              :disabled="isSaving"
              :aria-invalid="Boolean(fieldErrors.academicYear)"
              :aria-describedby="fieldErrors.academicYear ? 'semester-academic-year-error' : undefined"
            >
            <p v-if="fieldErrors.academicYear" id="semester-academic-year-error" class="field-error">{{ fieldErrors.academicYear }}</p>
            <p v-else class="field-help">Gunakan dua tahun berurutan, misalnya 2026/2027.</p>
          </div>

          <div class="form-field">
            <label for="semester-term">Semester <span aria-hidden="true">*</span></label>
            <select id="semester-term" v-model="form.term" :disabled="isSaving">
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
            <p v-if="fieldErrors.term" class="field-error">{{ fieldErrors.term }}</p>
          </div>

          <div class="form-field">
            <label for="semester-starts-on">Tanggal mulai <span aria-hidden="true">*</span></label>
            <input id="semester-starts-on" v-model="form.startsOn" type="date" required :disabled="isSaving" :aria-invalid="Boolean(fieldErrors.startsOn)">
            <p v-if="fieldErrors.startsOn" class="field-error">{{ fieldErrors.startsOn }}</p>
          </div>

          <div class="form-field">
            <label for="semester-ends-on">Tanggal selesai <span aria-hidden="true">*</span></label>
            <input id="semester-ends-on" v-model="form.endsOn" type="date" :min="form.startsOn || undefined" required :disabled="isSaving" :aria-invalid="Boolean(fieldErrors.endsOn)">
            <p v-if="fieldErrors.endsOn" class="field-error">{{ fieldErrors.endsOn }}</p>
          </div>
        </div>

        <fieldset v-if="formMode === 'create'" class="roster-source-picker">
          <legend>Daftar siswa</legend>
          <label class="roster-source-option" :class="{ 'roster-source-selected': rosterSource === 'previous' }">
            <input v-model="rosterSource" type="radio" value="previous" :disabled="isSaving || !availablePreviousSemester">
            <span>
              <strong>Salin siswa yang masih terdaftar</strong>
              <small v-if="availablePreviousSemester">dari {{ semesterLabel(availablePreviousSemester) }} · {{ availablePreviousSemester.studentsAtEnd }} siswa</small>
              <small v-else>Belum ada semester arsip sebelum tanggal mulai ini.</small>
            </span>
          </label>
          <label class="roster-source-option" :class="{ 'roster-source-selected': rosterSource === 'empty' }">
            <input v-model="rosterSource" type="radio" value="empty" :disabled="isSaving">
            <span><strong>Mulai dengan daftar kosong</strong></span>
          </label>
          <div class="notice-panel roster-copy-notice">
            <h3>Salinan membuat data semester baru.</h3>
            <p>Absensi dan identitas arsip lama tetap tersimpan. Siswa yang disalin belum memiliki catatan absensi di semester ini.</p>
          </div>
          <p v-if="rosterSource === 'previous' && !availablePreviousSemester" class="field-error" role="alert">
            Tidak ada semester arsip sebelum tanggal mulai ini. Pilih daftar kosong atau ubah tanggal mulai.
          </p>
        </fieldset>

        <div class="form-actions">
          <button class="secondary-button" type="button" :disabled="isSaving" @click="closeForm">Batal</button>
          <button class="primary-button" type="submit" :disabled="isSaving || (formMode === 'create' && rosterSource === 'previous' && !availablePreviousSemester)">
            {{ isSaving ? 'Menyimpan…' : formMode === 'edit' ? 'Simpan perubahan' : 'Buat semester' }}
          </button>
        </div>
      </form>
    </section>

    <div v-if="isClosureOpen" class="dialog-backdrop" @click.self="closeClosure">
      <section class="closure-dialog" role="dialog" aria-modal="true" aria-labelledby="closure-dialog-title" aria-describedby="closure-dialog-description">
        <div class="closure-dialog-heading">
          <div>
            <p class="eyebrow">Periksa sebelum menutup</p>
            <h2 id="closure-dialog-title">Tutup semester?</h2>
          </div>
          <button class="dialog-dismiss" type="button" aria-label="Tutup konfirmasi" :disabled="isClosing" @click="closeClosure">×</button>
        </div>

        <p v-if="closurePreview" class="closure-period-line">
          {{ semesterLabel({ ...closurePreview.semester, studentsAtEnd: 0 }) }} · {{ formatDate(closurePreview.semester.startsOn) }}–{{ formatDate(closurePreview.semester.endsOn) }}
        </p>
        <p v-else-if="activeSemester" class="closure-period-line">{{ semesterLabel(activeSemester) }} · {{ formatDate(activeSemester.startsOn) }}–{{ formatDate(activeSemester.endsOn) }}</p>

        <p v-if="isLoadingPreview" class="closure-loading" role="status">Memeriksa hari sekolah dan absensi…</p>
        <p v-if="closureError" class="form-error page-message" role="alert">{{ closureError }}</p>
        <p v-if="previewChanged" class="closure-changed-note" role="status">Ringkasan terbaru sudah dimuat. Periksa jumlah di bawah ini sebelum memilih Tutup semester lagi.</p>

        <template v-if="closurePreview">
          <div v-if="!closurePreview.calendarConfigured" class="closure-warning" role="status">
            <strong>Kalender sekolah belum diatur lengkap.</strong>
            <span>Jumlah hari sekolah dan absensi belum dapat dihitung. Kalender kosong tidak dianggap sama dengan tujuh hari yang sengaja ditandai libur.</span>
          </div>
          <div v-else-if="closurePreview.schoolDayCount === 0" class="closure-complete-note">
            <strong>Dalam periode ini tidak ada hari sekolah.</strong>
            <span>Kalender rutin sudah diatur untuk semua hari dalam seminggu. Penutupan tetap perlu dikonfirmasi.</span>
          </div>
          <div v-else-if="(closurePreview.incompleteSchoolDayCount ?? 0) > 0" class="closure-warning">
            <strong>Masih ada {{ closurePreview.incompleteSchoolDayCount }} hari sekolah dengan absensi belum lengkap.</strong>
            <span>{{ closurePreview.blankCellCount }} catatan absensi siswa masih kosong dari {{ closurePreview.eligibleCellCount }} catatan yang dapat diisi. Tanggal kosong tetap kosong, tidak dihitung sebagai Alpa.</span>
          </div>
          <div v-else class="closure-complete-note">
            <strong>Absensi pada semua hari sekolah sudah lengkap.</strong>
            <span>{{ closurePreview.filledCellCount }} catatan tersimpan untuk {{ closurePreview.schoolDayCount }} hari sekolah.</span>
          </div>

          <dl v-if="closurePreview.calendarConfigured" class="closure-counts">
            <div><dt>Hari sekolah</dt><dd>{{ closurePreview.schoolDayCount }}</dd></div>
            <div><dt>Absensi terisi</dt><dd>{{ closurePreview.filledCellCount }} / {{ closurePreview.eligibleCellCount }}</dd></div>
            <div><dt>Catatan kosong</dt><dd>{{ closurePreview.blankCellCount }}</dd></div>
          </dl>
        </template>

        <div class="closure-lock-copy" id="closure-dialog-description">
          <strong>Setelah ditutup, semester ini hanya dapat dilihat sebagai arsip.</strong>
          <span>Absensi tidak dapat dikoreksi dan semester tidak dapat dibuka kembali.</span>
        </div>
        <p class="closure-confirm-question">Apakah Anda tetap ingin menutup semester ini?</p>

        <div class="closure-dialog-actions">
          <button class="secondary-button" type="button" :disabled="isClosing" @click="closeClosure">Periksa lagi</button>
          <button class="close-semester-button" type="button" :disabled="isClosing || isLoadingPreview || !closurePreview" @click="confirmClosure">
            {{ isClosing ? 'Menutup…' : 'Tutup semester' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
