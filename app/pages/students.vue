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
const importOpen=ref(false)
const importFile=shallowRef<File|null>(null)
const importBusy=ref(false)
const importError=ref('')
const importConfirmed=ref(false)
const importPreview=ref<{token:string;expiresAt:string;rows:{rowId:number;values:string[];errors:string[];duplicate:boolean}[]}|null>(null)
const importChoices=ref<Record<number,string>>({})
const importSemesterId=ref('')
const importSummary=ref<HTMLElement|null>(null)
const importConfirmation=ref<HTMLElement|null>(null)
const importTrigger=ref<HTMLButtonElement|null>(null)
const importSelected=computed(()=>importPreview.value?.rows.filter(row=>['include','add-distinct'].includes(importChoices.value[row.rowId]??'')).length??0)
const importInvalid=computed(()=>importPreview.value?.rows.filter(row=>row.errors.length&&['include','add-distinct'].includes(importChoices.value[row.rowId]??'')).length??0)
const importPending=computed(()=>importPreview.value?.rows.filter(row=>!importChoices.value[row.rowId]).length??0)
const importIncomplete=computed(()=>importPreview.value?.rows.some(row=>!importChoices.value[row.rowId])??false)
function openImport(){importSemesterId.value=selectedSemesterId.value;importOpen.value=true;importError.value='';saveSuccess.value='';nextTick(()=>importSummary.value?.focus())}
function closeImport(){if(importBusy.value)return;importOpen.value=false;importPreview.value=null;importChoices.value={};importFile.value=null;importConfirmed.value=false;nextTick(()=>importTrigger.value?.focus())}
function chooseImportFile(event:Event){importFile.value=(event.target as HTMLInputElement).files?.[0]??null;importPreview.value=null;importConfirmed.value=false;importError.value=''}
async function confirmImport(){importConfirmed.value=true;await nextTick();importConfirmation.value?.focus()}
async function previewImport(){
  if(!importFile.value||importBusy.value)return
  if(importFile.value.size>4194304){importError.value='Berkas maksimal 4 MiB. Kurangi ukuran lalu pilih kembali.';return}
  importBusy.value=true;importError.value='';importConfirmed.value=false
  try{const form=new FormData();form.append('semesterId',importSemesterId.value);form.append('file',importFile.value)
    const preview=await $fetch<NonNullable<typeof importPreview.value>>('/api/students/import/preview',{method:'POST',body:form,retry:0})
    importPreview.value=preview;importChoices.value=Object.fromEntries(preview.rows.map(row=>[row.rowId,row.duplicate?'':'include']))
    await nextTick();importSummary.value?.focus()
  }catch(error){importError.value=getApiMessage(error,'Berkas belum dapat diperiksa. Berkas dan pilihan tetap tersedia.')}finally{importBusy.value=false}
}
async function commitImport(){
  if(!importPreview.value||importBusy.value||!importConfirmed.value)return
  importBusy.value=true;importError.value=''
  try{const result=await $fetch<{count:number}>('/api/students/import/commit',{method:'POST',retry:0,body:{semesterId:importSemesterId.value,token:importPreview.value.token,choices:importPreview.value.rows.map(row=>({rowId:row.rowId,action:importChoices.value[row.rowId]}))}})
    importOpen.value=false;importPreview.value=null;importFile.value=null;importChoices.value={};importConfirmed.value=false
    saveSuccess.value=`${result.count} siswa berhasil diimpor.`;await loadRoster(1);await nextTick();importTrigger.value?.focus()
  }catch(error){importError.value=getApiMessage(error,'Impor belum tersimpan. Berkas dan pilihan tetap tersedia.');await nextTick();importSummary.value?.focus()}finally{importBusy.value=false}
}
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
      <div class="student-heading-actions">
      <button ref="importTrigger" v-if="list?.semester.id===selectedSemesterId && list?.semester.status==='active' && !loadingList && !isFormOpen && !importOpen" class="secondary-button" type="button" @click="openImport">Impor Excel</button>
      <button
        v-if="!loadingList && list?.semester.id === selectedSemesterId && list.semester.status === 'active' && !isFormOpen && !importOpen"
        class="primary-button add-student-button"
        type="button"
        @click="addStudent"
      >
        <span aria-hidden="true">＋</span> Tambah siswa
      </button>
      </div>
    </section>

    <p v-if="listError" class="form-error page-message" role="alert">{{ listError }}</p>
    <p v-if="semesterLoadError" class="form-error page-message" role="alert">
      {{ semesterLoadError }} <button class="text-button" type="button" @click="reloadSemesters">Coba lagi</button>
    </p>
    <p v-if="saveSuccess" class="success-message page-message" role="status">{{ saveSuccess }}</p>

    <section v-if="semesters.length" class="content-card roster-toolbar" aria-label="Pilih semester dan cari siswa">
      <div class="semester-picker">
        <label for="semester-picker">Semester</label>
        <select id="semester-picker" v-model="selectedSemesterId" :disabled="isFormOpen || importOpen || loadingList">
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

    <section v-if="importOpen" class="content-card import-card" aria-labelledby="import-heading">
      <div class="form-section-heading"><div><p class="eyebrow">Daftar siswa</p><h2 id="import-heading">Impor Excel</h2><p>Periksa setiap baris sebelum menambahkan siswa. Data siswa lama tetap tersimpan.</p></div><button class="text-button" type="button" :disabled="importBusy" @click="closeImport">Batal</button></div>
      <div ref="importSummary" tabindex="-1" class="import-summary">
        <p v-if="importError" class="form-error" role="alert">{{importError}}</p>
        <p v-if="importBusy" role="status">{{importConfirmed?'Menyimpan siswa…':'Memeriksa berkas…'}}</p>
        <p v-if="importPreview">{{importSelected}} baris dipilih · {{importInvalid}} baris terpilih perlu diperbaiki · {{importPending}} baris belum dipilih.</p>
      </div>
      <p>Gunakan satu lembar sesuai template, maksimal 4 MiB dan 500 baris. NIPD dan tanggal diisi sebagai teks; tanggal memakai YYYY-MM-DD.</p>
      <a class="secondary-button import-template" href="/api/students/import/template" download>Unduh template Excel</a>
      <div class="form-field"><label for="import-file">Berkas Excel (.xlsx)</label><input id="import-file" type="file" accept=".xlsx" :disabled="importBusy" @change="chooseImportFile"><p v-if="importFile">{{importFile.name}}</p></div>
      <button class="secondary-button" type="button" :disabled="!importFile||importBusy" @click="previewImport">{{importPreview?'Periksa berkas lagi':'Periksa berkas'}}</button>
      <div v-if="importPreview" class="import-rows">
        <p>Data di bawah hanya dapat dibaca. Perbaiki berkas lalu periksa lagi, atau lewati baris yang bermasalah. Untuk nama sama, tentukan pilihan setiap baris.</p>
        <div class="import-table-wrap"><table class="student-table"><thead><tr><th>Baris</th><th>Nama / NIPD</th><th>JK</th><th>Tanggal masuk / keluar</th><th>Pemeriksaan</th><th>Pilihan</th></tr></thead><tbody><tr v-for="row in importPreview.rows" :key="row.rowId"><td>{{row.rowId}}</td><td><strong>{{row.values[0]||'Nama belum diisi'}}</strong><br>{{row.values[1]||'—'}}</td><td>{{row.values[2]||'—'}}</td><td>{{row.values[3]||'Awal semester'}}<br>{{row.values[4]||'—'}}</td><td><p v-if="row.duplicate" class="duplicate-note">Nama sama ditemukan.</p><ul v-if="row.errors.length" class="field-error"><li v-for="error in row.errors" :key="error">{{error}}</li></ul><span v-if="!row.errors.length&&!row.duplicate">Siap diperiksa</span></td><td><label class="visually-hidden" :for="`import-desktop-${row.rowId}`">Pilihan baris {{row.rowId}}</label><select :id="`import-desktop-${row.rowId}`" v-model="importChoices[row.rowId]" :disabled="importBusy" @change="importConfirmed=false"><option v-if="row.duplicate" value="" disabled>Pilih tindakan</option><option :value="row.duplicate?'add-distinct':'include'">{{row.duplicate?'Tambah sebagai siswa berbeda':'Masukkan siswa'}}</option><option value="skip">Lewati baris ini</option></select></td></tr></tbody></table></div>
        <article v-for="row in importPreview.rows" :key="row.rowId" class="import-row import-mobile-row" :class="{'import-row-invalid':row.errors.length}">
          <div><h3>Baris {{row.rowId}} · {{row.values[0]||'Nama belum diisi'}}</h3><p>NIPD: {{row.values[1]||'—'}} · Jenis kelamin: {{row.values[2]||'—'}}</p><p>Tanggal masuk: {{row.values[3]||'Awal semester'}} · Keluar: {{row.values[4]||'—'}}</p><p v-if="row.duplicate" class="duplicate-note">Nama sama ditemukan. Data lama tidak ditimpa.</p><ul v-if="row.errors.length" class="field-error"><li v-for="error in row.errors" :key="error">{{error}}</li></ul></div>
          <div class="form-field"><label :for="`import-row-${row.rowId}`">Pilihan baris {{row.rowId}}</label><select :id="`import-row-${row.rowId}`" v-model="importChoices[row.rowId]" :disabled="importBusy" @change="importConfirmed=false"><option v-if="row.duplicate" value="" disabled>Pilih tindakan</option><option :value="row.duplicate?'add-distinct':'include'">{{row.duplicate?'Tambah sebagai siswa berbeda':'Masukkan siswa'}}</option><option value="skip">Lewati baris ini</option></select></div>
        </article>
        <p v-if="importInvalid" class="form-error">Impor ditahan karena ada baris terpilih yang perlu diperbaiki.</p>
        <button v-if="!importConfirmed" class="primary-button" type="button" :disabled="importBusy||!importSelected||importInvalid>0||importIncomplete" @click="confirmImport">Lanjutkan impor {{importSelected}} siswa</button>
        <div v-else ref="importConfirmation" tabindex="-1" class="import-confirm" role="group" aria-label="Konfirmasi impor"><p>Tambahkan {{importSelected}} siswa ke semester ini? Siswa yang sudah ada tetap tersimpan.</p><button class="secondary-button" type="button" :disabled="importBusy" @click="importConfirmed=false;nextTick(()=>importSummary?.focus())">Periksa pilihan</button><button class="primary-button" type="button" :disabled="importBusy" @click="commitImport">{{importBusy?'Menyimpan…':'Ya, impor siswa'}}</button></div>
      </div>
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
