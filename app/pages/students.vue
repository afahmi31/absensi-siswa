<script setup lang="ts">
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'

interface SemesterOption {
  id: string
  academicYear: string
  term: 'ganjil' | 'genap'
  startsOn: string
  endsOn: string
  status: 'active' | 'closed'
}

interface StudentRow {
  membershipId: string
  fullName: string
  studentNumber: string
  gender: '' | 'L' | 'P'
  startsOn: string
  endsOn: string
  membershipStatus: 'upcoming' | 'current' | 'ended'
}

interface StudentListResponse {
  semester: { id: string; status: 'active' | 'closed'; startsOn: string; endsOn: string }
  students: StudentRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface SemestersResponse {
  semesters: SemesterOption[]
}

const requestFetch = useRequestFetch()
const semestersResult = await requestFetch<SemestersResponse>('/api/semesters').catch(() => null)
const semesters = ref(semestersResult?.semesters ?? [])
const semesterLoadFailed = ref(semestersResult === null)
const selectedSemesterId = ref(
  semesters.value.find((semester) => semester.status === 'active')?.id ?? semesters.value[0]?.id ?? '',
)
const search = ref('')
const list = ref<StudentListResponse | null>(null)
const loadingList = ref(false)
const listError = ref(semestersResult === null ? 'Semester belum dapat dimuat. Coba muat ulang halaman.' : '')
const semesterLoadError = ref('')
const isFormOpen = ref(false)
const isSaving = ref(false)
const isEditing = ref(false)
const editingMembershipId = ref('')
const saveError = ref('')
const saveSuccess = ref('')
const fieldErrors = ref<Record<string, string>>({})
const formSemesterId = ref('')
let rosterRequestSequence = 0
const draft = reactive({
  fullName: '',
  studentNumber: '',
  gender: '' as '' | 'L' | 'P',
  startsOn: '',
  endsOn: '',
})

function rosterUrl(page = 1): string {
  const params = new URLSearchParams({ semesterId: selectedSemesterId.value, search: search.value.trim(), page: String(page) })
  return `/api/students?${params.toString()}`
}

async function loadRoster(page = 1) {
  if (!selectedSemesterId.value) {
    list.value = null
    return
  }
  const requestSequence = ++rosterRequestSequence
  const requestSemesterId = selectedSemesterId.value
  loadingList.value = true
  listError.value = ''
  const result = await requestFetch<StudentListResponse>(rosterUrl(page)).catch((error: unknown) => {
    if (requestSequence === rosterRequestSequence && requestSemesterId === selectedSemesterId.value) {
      listError.value = getApiMessage(error, 'Daftar siswa belum dapat dimuat. Coba lagi.')
    }
    return null
  })
  if (requestSequence === rosterRequestSequence && requestSemesterId === selectedSemesterId.value) {
    if (result) list.value = result
    loadingList.value = false
  }
}

function clearDraft() {
  draft.fullName = ''
  draft.studentNumber = ''
  draft.gender = ''
  draft.startsOn = list.value?.semester.startsOn ?? ''
  draft.endsOn = ''
  fieldErrors.value = {}
  saveError.value = ''
  saveSuccess.value = ''
}

function addStudent() {
  clearDraft()
  formSemesterId.value = selectedSemesterId.value
  editingMembershipId.value = ''
  isEditing.value = false
  isFormOpen.value = true
}

function editStudent(student: StudentRow) {
  clearDraft()
  formSemesterId.value = selectedSemesterId.value
  editingMembershipId.value = student.membershipId
  isEditing.value = true
  draft.fullName = student.fullName
  draft.studentNumber = student.studentNumber
  draft.gender = student.gender
  draft.startsOn = student.startsOn
  draft.endsOn = student.endsOn
  isFormOpen.value = true
}

function closeForm() {
  isFormOpen.value = false
  saveError.value = ''
  fieldErrors.value = {}
}

async function saveStudent() {
  if (
    !list.value
    || list.value.semester.id !== formSemesterId.value
    || formSemesterId.value !== selectedSemesterId.value
    || list.value.semester.status !== 'active'
  ) return
  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = ''
  fieldErrors.value = {}
  const body = {
    fullName: draft.fullName,
    studentNumber: draft.studentNumber,
    gender: draft.gender,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
  }
  try {
    if (isEditing.value) {
      await $fetch(`/api/students/${encodeURIComponent(editingMembershipId.value)}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/students', { method: 'POST', body: { ...body, semesterId: formSemesterId.value } })
    }
    isFormOpen.value = false
    saveSuccess.value = isEditing.value ? 'Perubahan siswa tersimpan.' : 'Siswa ditambahkan ke daftar.'
    await loadRoster(list.value.page)
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    saveError.value = getApiMessage(error, 'Perubahan belum tersimpan. Isian tetap tersedia agar dapat diperbaiki.')
  } finally {
    isSaving.value = false
  }
}

function semesterLabel(semester: SemesterOption): string {
  const term = semester.term === 'ganjil' ? 'Ganjil' : 'Genap'
  const status = semester.status === 'closed' ? 'Arsip' : 'Aktif'
  return `${semester.academicYear} · ${term} · ${status}`
}

function membershipLabel(student: StudentRow): string {
  if (student.membershipStatus === 'upcoming') return 'Belum masuk'
  if (student.membershipStatus === 'ended') return 'Sudah keluar'
  return 'Aktif'
}

function dateRange(student: StudentRow): string {
  return `${student.startsOn} – ${student.endsOn || 'Belum ditentukan'}`
}

async function reloadSemesters() {
  semesterLoadError.value = ''
  const result = await requestFetch<SemestersResponse>('/api/semesters').catch(() => null)
  if (!result) {
    semesterLoadFailed.value = true
    semesterLoadError.value = 'Daftar semester belum dapat dimuat. Coba lagi.'
    return
  }
  semesterLoadFailed.value = false
  semesters.value = result.semesters
  if (!selectedSemesterId.value || !result.semesters.some((semester) => semester.id === selectedSemesterId.value)) {
    selectedSemesterId.value = result.semesters.find((semester) => semester.status === 'active')?.id ?? result.semesters[0]?.id ?? ''
    if (selectedSemesterId.value) await loadRoster(1)
  }
}

if (selectedSemesterId.value) await loadRoster(1)

watch(selectedSemesterId, async (semesterId) => {
  if (!semesterId) {
    list.value = null
    return
  }
  list.value = null
  search.value = ''
  saveSuccess.value = ''
  await loadRoster(1)
})
</script>

<template>
  <main class="page-content students-page">
    <section class="page-heading students-heading">
      <div>
        <p class="eyebrow">Data kelas</p>
        <h1>Siswa</h1>
        <p>Cari dan perbarui data siswa untuk semester yang dipilih.</p>
      </div>
      <button
        v-if="!loadingList && list?.semester.id === selectedSemesterId && list.semester.status === 'active' && !isFormOpen"
        class="primary-button add-student-button"
        type="button"
        @click="addStudent"
      >
        <span aria-hidden="true">＋</span> Tambah siswa
      </button>
    </section>

    <p v-if="listError" class="form-error page-message" role="alert">{{ listError }}</p>
    <p v-if="semesterLoadError" class="form-error page-message" role="alert">
      {{ semesterLoadError }} <button class="text-button" type="button" @click="reloadSemesters">Coba lagi</button>
    </p>
    <p v-if="saveSuccess" class="success-message page-message" role="status">{{ saveSuccess }}</p>

    <section v-if="semesters.length" class="content-card roster-toolbar" aria-label="Pilih semester dan cari siswa">
      <div class="semester-picker">
        <label for="semester-picker">Semester</label>
        <select id="semester-picker" v-model="selectedSemesterId" :disabled="isFormOpen || loadingList">
          <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
            {{ semesterLabel(semester) }}
          </option>
        </select>
      </div>
      <form class="student-search" role="search" @submit.prevent="loadRoster(1)">
        <label for="student-search">Cari nama atau NIPD</label>
        <div class="search-controls">
          <input id="student-search" v-model="search" type="search" maxlength="100" placeholder="Ketik nama atau NIPD" :disabled="isFormOpen || loadingList">
          <button class="secondary-button search-button" type="submit" :disabled="isFormOpen || loadingList">Cari</button>
        </div>
      </form>
    </section>

    <section v-if="semesterLoadFailed && !semesters.length" class="content-card empty-state" aria-labelledby="semester-error-title">
      <h2 id="semester-error-title">Semester belum dapat dimuat</h2>
      <p>Periksa koneksi lalu coba muat ulang halaman.</p>
      <button class="secondary-button" type="button" @click="reloadSemesters">Coba lagi</button>
    </section>

    <section v-else-if="semesters.length === 0" class="content-card empty-state" aria-labelledby="no-semester-title">
      <span class="empty-state-icon" aria-hidden="true">▤</span>
      <h2 id="no-semester-title">Belum ada semester</h2>
      <p>Daftar siswa akan tersedia setelah semester dibuat. Pembuatan semester belum tersedia pada tahap ini.</p>
    </section>

    <section v-else-if="list" class="content-card roster-card" aria-labelledby="roster-title">
      <div class="roster-header">
        <div>
          <h2 id="roster-title">Daftar siswa</h2>
          <p>{{ list.total }} siswa · Periode {{ list.semester.startsOn }} sampai {{ list.semester.endsOn }}</p>
        </div>
        <span v-if="list.semester.status === 'closed'" class="archive-badge">Arsip · hanya baca</span>
        <span v-else class="active-badge">Semester aktif</span>
      </div>

      <p v-if="loadingList" class="list-loading" role="status">Memuat daftar siswa…</p>
      <div v-else-if="list.students.length" class="student-list">
        <div class="student-table-wrap">
          <table class="student-table">
            <thead>
              <tr>
                <th scope="col">Nama siswa</th>
                <th scope="col">NIPD</th>
                <th scope="col">Jenis kelamin</th>
                <th scope="col">Tanggal terdaftar</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="visually-hidden">Tindakan</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in list.students" :key="student.membershipId">
                <td class="student-name-cell">{{ student.fullName }}</td>
                <td>{{ student.studentNumber || '—' }}</td>
                <td>{{ student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : '—' }}</td>
                <td>{{ dateRange(student) }}</td>
                <td><span class="membership-badge" :class="`membership-${student.membershipStatus}`">{{ membershipLabel(student) }}</span></td>
                <td class="table-action-cell">
                  <button v-if="list.semester.status === 'active' && !isFormOpen" class="text-button" type="button" @click="editStudent(student)">Ubah</button>
                  <span v-else-if="list.semester.status === 'closed'" class="read-only-label">Arsip</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="student-cards">
          <article v-for="student in list.students" :key="student.membershipId" class="student-card">
            <div class="student-card-heading">
              <h3>{{ student.fullName }}</h3>
              <span class="membership-badge" :class="`membership-${student.membershipStatus}`">{{ membershipLabel(student) }}</span>
            </div>
            <dl>
              <div><dt>NIPD</dt><dd>{{ student.studentNumber || '—' }}</dd></div>
              <div><dt>Jenis kelamin</dt><dd>{{ student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : '—' }}</dd></div>
              <div><dt>Tanggal terdaftar</dt><dd>{{ dateRange(student) }}</dd></div>
            </dl>
            <button v-if="list.semester.status === 'active' && !isFormOpen" class="secondary-button card-edit-button" type="button" @click="editStudent(student)">Ubah data siswa</button>
          </article>
        </div>
      </div>
      <div v-else class="roster-empty">
        <h3>{{ search.trim() ? 'Siswa tidak ditemukan' : 'Belum ada siswa pada semester ini' }}</h3>
        <p>{{ search.trim() ? 'Coba nama atau NIPD lain.' : list.semester.status === 'closed' ? 'Belum ada data siswa pada arsip ini.' : 'Tambahkan siswa untuk mulai mengelola daftar kelas.' }}</p>
        <button v-if="!search.trim() && list.semester.status === 'active' && !isFormOpen" class="text-button" type="button" @click="addStudent">Tambah siswa</button>
      </div>

      <div v-if="list.totalPages > 1" class="pagination" aria-label="Halaman daftar siswa">
        <button class="secondary-button" type="button" :disabled="loadingList || isFormOpen || list.page <= 1" @click="loadRoster(list.page - 1)">Sebelumnya</button>
        <span>Halaman {{ list.page }} dari {{ list.totalPages }}</span>
        <button class="secondary-button" type="button" :disabled="loadingList || isFormOpen || list.page >= list.totalPages" @click="loadRoster(list.page + 1)">Berikutnya</button>
      </div>
    </section>

    <section v-if="isFormOpen" class="content-card student-form-card" aria-labelledby="student-form-title">
      <div class="form-section-heading">
        <div>
          <p class="eyebrow">{{ isEditing ? 'Perbarui data' : 'Daftar siswa' }}</p>
          <h2 id="student-form-title">{{ isEditing ? 'Ubah data siswa' : 'Tambah siswa' }}</h2>
          <p>Tanggal masuk dan keluar termasuk dalam masa terdaftar.</p>
        </div>
        <button class="text-button close-form-button" type="button" :disabled="isSaving" @click="closeForm">Tutup</button>
      </div>

      <p v-if="list?.semester.status === 'active'" class="snapshot-note">Nama, NIPD, dan jenis kelamin disimpan pada semester ini. Data arsip semester lain tetap tersimpan.</p>
      <p v-if="saveError" class="form-error page-message" role="alert">{{ saveError }}</p>

      <form class="student-form" @submit.prevent="saveStudent">
        <div class="form-grid">
          <div class="form-field form-field-wide">
            <label for="student-full-name">Nama siswa <span aria-hidden="true">*</span></label>
            <input
              id="student-full-name"
              v-model="draft.fullName"
              autocomplete="name"
              maxlength="200"
              required
              :disabled="isSaving"
              :aria-invalid="Boolean(fieldErrors.fullName)"
              :aria-describedby="fieldErrors.fullName ? 'student-full-name-error' : undefined"
            >
            <p v-if="fieldErrors.fullName" id="student-full-name-error" class="field-error">{{ fieldErrors.fullName }}</p>
          </div>

          <div class="form-field">
            <label for="student-number">NIPD <span class="optional-label">Opsional</span></label>
            <input id="student-number" v-model="draft.studentNumber" maxlength="80" autocomplete="off" :disabled="isSaving">
            <p v-if="fieldErrors.studentNumber" class="field-error">{{ fieldErrors.studentNumber }}</p>
          </div>

          <div class="form-field">
            <label for="student-gender">Jenis kelamin <span class="optional-label">Opsional</span></label>
            <select id="student-gender" v-model="draft.gender" :disabled="isSaving">
              <option value="">Tidak dipilih</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
            <p v-if="fieldErrors.gender" class="field-error">{{ fieldErrors.gender }}</p>
          </div>

          <div class="form-field">
            <label for="student-starts-on">Tanggal masuk <span class="optional-label">Awal semester bila kosong</span></label>
            <input id="student-starts-on" v-model="draft.startsOn" type="date" :min="list?.semester.startsOn" :max="list?.semester.endsOn" :disabled="isSaving">
            <p v-if="fieldErrors.startsOn" class="field-error">{{ fieldErrors.startsOn }}</p>
          </div>

          <div class="form-field">
            <label for="student-ends-on">Tanggal keluar <span class="optional-label">Opsional</span></label>
            <input id="student-ends-on" v-model="draft.endsOn" type="date" :min="draft.startsOn || list?.semester.startsOn" :max="list?.semester.endsOn" :disabled="isSaving">
            <p v-if="fieldErrors.endsOn" class="field-error">{{ fieldErrors.endsOn }}</p>
          </div>
        </div>

        <div class="form-actions">
          <button class="secondary-button" type="button" :disabled="isSaving" @click="closeForm">Batal</button>
          <button class="primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? 'Menyimpan…' : isEditing ? 'Simpan perubahan' : 'Simpan siswa' }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
