<script setup lang="ts">
import { getApiMessage } from '../utils/api-errors.ts'

type AttendanceStatus = 'H' | 'S' | 'I' | 'A'
type StatusChoice = AttendanceStatus | null

interface SemesterOption {
  id: string
  academicYear: string
  term: 'ganjil' | 'genap'
  startsOn: string
  endsOn: string
  status: 'active' | 'closed'
}

interface AttendanceDay {
  school: { id: string; name: string; timeZone: string; className: string } | null
  semester: SemesterOption | null
  schoolLocalToday: string | null
  date: string
  dayOfWeek: number | null
  routineConfigured: boolean
  isSchoolDay: boolean
  exceptionKind: 'holiday' | 'school_day' | null
  note: string | null
  roster: Array<{
    id: string
    name: string
    studentNumber: string | null
    gender: 'L' | 'P' | null
    startsOn: string
    endsOn: string | null
    updatedAt: string
    status: StatusChoice
  }>
  unfilledCount: number
  historyCount: number
  readOnlyReason: 'semester_closed' | 'future_date' | 'calendar_holiday' | 'calendar_unset' | 'not_school_day' | null
  revision: string
}

interface AttendanceHistoryItem {
  id: string
  date: string
  studentName: string
  studentNumber: string | null
  statusBefore: AttendanceStatus | null
  statusAfter: AttendanceStatus | null
  actorTeacherId: string | null
  actorKind: 'teacher' | 'system'
  occurredAt: string
  isEffective: boolean
  exclusionReason: string | null
}

const statusChoices: Array<{ value: StatusChoice; short: string; label: string }> = [
  { value: 'H', short: 'H', label: 'Hadir' },
  { value: 'S', short: 'S', label: 'Sakit' },
  { value: 'I', short: 'I', label: 'Izin' },
  { value: 'A', short: 'A', label: 'Alpa' },
  { value: null, short: '—', label: 'Belum diisi' },
]

const requestFetch = useRequestFetch()
const initialSemesters = await requestFetch<{ semesters: SemesterOption[] }>('/api/semesters').catch(() => null)
const initialCalendar = await requestFetch<{ schoolLocalToday: string | null }>('/api/calendar').catch(() => null)
const semesters = ref(initialSemesters?.semesters ?? [])
const semesterLoadError = ref(initialSemesters ? '' : 'Daftar semester belum dapat dimuat. Coba lagi.')
const semesterLoading = ref(false)
const selectedSemesterId = ref(semesters.value.find((item) => item.status === 'active')?.id ?? semesters.value[0]?.id ?? '')
const selectedSemester = computed(() => semesters.value.find((item) => item.id === selectedSemesterId.value) ?? null)
const schoolLocalToday = ref(initialCalendar?.schoolLocalToday ?? null)

function clampDate(semester: SemesterOption, preferred: string | null): string {
  if (!preferred) return semester.endsOn
  if (preferred < semester.startsOn) return semester.startsOn
  if (preferred > semester.endsOn) return semester.endsOn
  return preferred
}

const selectedDate = ref(selectedSemester.value
  ? clampDate(selectedSemester.value, schoolLocalToday.value)
  : '')
const initialDay = selectedSemester.value && selectedDate.value
  ? await requestFetch<AttendanceDay>(`/api/attendance/${encodeURIComponent(selectedSemester.value.id)}/${encodeURIComponent(selectedDate.value)}`).catch(() => null)
  : null
const day = ref<AttendanceDay | null>(initialDay)
const dayLoading = ref(false)
const dayError = ref(initialDay || !selectedSemester.value ? '' : 'Absensi belum dapat dimuat. Coba muat ulang halaman.')
const saveError = ref('')
const saveSuccess = ref('')
const saveConflict = ref(false)
const isSaving = ref(false)
const draft = reactive<Record<string, StatusChoice>>({})
const history = ref<AttendanceHistoryItem[] | null>(null)
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyError = ref('')
let dayRequestSequence = 0
let historyRequestSequence = 0

function copyServerDay(data: AttendanceDay) {
  day.value = data
  schoolLocalToday.value = data.schoolLocalToday
  for (const key of Object.keys(draft)) delete draft[key]
  for (const member of data.roster) draft[member.id] = member.status
}

if (initialDay) copyServerDay(initialDay)

async function retrySemesterLoad() {
  if (semesterLoading.value) return
  semesterLoading.value = true
  try {
    const [result, calendar] = await Promise.all([
      $fetch<{ semesters: SemesterOption[] }>('/api/semesters'),
      $fetch<{ schoolLocalToday: string | null }>('/api/calendar').catch(() => null),
    ])
    semesters.value = result.semesters
    if (calendar) schoolLocalToday.value = calendar.schoolLocalToday
    semesterLoadError.value = ''
    const nextSemester = semesters.value.find((item) => item.status === 'active') ?? semesters.value[0] ?? null
    selectedSemesterId.value = nextSemester?.id ?? ''
    selectedDate.value = nextSemester ? clampDate(nextSemester, schoolLocalToday.value) : ''
    if (nextSemester) await loadDay()
  } catch (error) {
    semesterLoadError.value = getApiMessage(error, 'Daftar semester belum dapat dimuat. Coba lagi.')
  } finally {
    semesterLoading.value = false
  }
}

const isDirty = computed(() => {
  if (!day.value) return false
  return day.value.roster.some((member) => draft[member.id] !== member.status)
})
const isReadOnly = computed(() => !day.value || day.value.readOnlyReason !== null)
const pendingCount = computed(() => day.value?.roster.filter((member) => !draft[member.id]).length ?? 0)
const statusCounts = computed(() => ({
  H: day.value?.roster.filter((member) => draft[member.id] === 'H').length ?? 0,
  S: day.value?.roster.filter((member) => draft[member.id] === 'S').length ?? 0,
  I: day.value?.roster.filter((member) => draft[member.id] === 'I').length ?? 0,
  A: day.value?.roster.filter((member) => draft[member.id] === 'A').length ?? 0,
}))
const dateMax = computed(() => {
  const semester = selectedSemester.value
  if (!semester || semester.status === 'closed' || !schoolLocalToday.value) return semester?.endsOn ?? undefined
  return schoolLocalToday.value < semester.endsOn ? schoolLocalToday.value : semester.endsOn
})
const readOnlyMessage = computed(() => {
  switch (day.value?.readOnlyReason) {
    case 'semester_closed': return 'Semester ini sudah ditutup. Absensi hanya dapat dilihat sebagai arsip.'
    case 'future_date': return 'Tanggal ini belum dapat diisi karena masih setelah hari ini menurut zona waktu sekolah.'
    case 'calendar_holiday': return day.value.note
      ? `Tanggal ini libur. Catatan lama tetap ada dan tidak dihitung. ${day.value.note}`
      : 'Tanggal ini libur. Catatan lama tetap ada dan tidak dihitung.'
    case 'calendar_unset': return 'Kalender untuk tanggal ini belum diatur. Atur kalender sekolah sebelum mengisi absensi.'
    case 'not_school_day': return 'Tanggal ini bukan hari sekolah. Catatan lama tetap ada dan tidak dihitung.'
    default: return ''
  }
})

function semesterLabel(semester: SemesterOption): string {
  return `${semester.term === 'ganjil' ? 'Ganjil' : 'Genap'} ${semester.academicYear}${semester.status === 'closed' ? ' · Arsip' : ''}`
}

async function loadDay() {
  historyRequestSequence += 1
  historyLoading.value = false
  if (!selectedSemesterId.value || !selectedDate.value) {
    day.value = null
    return
  }
  const requestSequence = ++dayRequestSequence
  const requestSemesterId = selectedSemesterId.value
  const requestDate = selectedDate.value
  const previousDay = day.value
  dayLoading.value = true
  dayError.value = ''
  history.value = null
  historyError.value = ''
  historyOpen.value = false
  try {
    const result = await $fetch<AttendanceDay>(`/api/attendance/${encodeURIComponent(requestSemesterId)}/${encodeURIComponent(requestDate)}`)
    if (requestSequence !== dayRequestSequence || requestSemesterId !== selectedSemesterId.value || requestDate !== selectedDate.value) return
    copyServerDay(result)
    saveError.value = ''
    saveSuccess.value = ''
    saveConflict.value = false
  } catch (error) {
    if (requestSequence === dayRequestSequence && requestSemesterId === selectedSemesterId.value && requestDate === selectedDate.value) {
      dayError.value = getApiMessage(error, 'Absensi belum dapat dimuat. Coba lagi.')
      if (previousDay?.semester) {
        selectedSemesterId.value = previousDay.semester.id
        selectedDate.value = previousDay.date
      }
    }
  } finally {
    if (requestSequence === dayRequestSequence) dayLoading.value = false
  }
}

function changeSemester(event: Event) {
  const nextId = (event.target as HTMLSelectElement).value
  if (nextId === selectedSemesterId.value) return
  if (isDirty.value && !window.confirm('Perubahan absensi belum disimpan. Ganti semester dan buang perubahan ini?')) {
    ;(event.target as HTMLSelectElement).value = selectedSemesterId.value
    return
  }
  selectedSemesterId.value = nextId
  const nextSemester = semesters.value.find((item) => item.id === nextId)
  selectedDate.value = nextSemester ? clampDate(nextSemester, schoolLocalToday.value) : ''
  void loadDay()
}

function changeDate(event: Event) {
  const nextDate = (event.target as HTMLInputElement).value
  if (nextDate === selectedDate.value) return
  if (isDirty.value && !window.confirm('Perubahan absensi belum disimpan. Ganti tanggal dan buang perubahan ini?')) {
    ;(event.target as HTMLInputElement).value = selectedDate.value
    return
  }
  selectedDate.value = nextDate
  void loadDay()
}

function selectStatus(membershipId: string, status: StatusChoice) {
  if (isReadOnly.value || isSaving.value || !Object.hasOwn(draft, membershipId)) return
  draft[membershipId] = status
  if (!saveConflict.value) saveError.value = ''
  saveSuccess.value = ''
}

function markAllPresent() {
  if (isReadOnly.value || isSaving.value) return
  for (const member of day.value?.roster ?? []) draft[member.id] = 'H'
  if (!saveConflict.value) saveError.value = ''
  saveSuccess.value = ''
}

async function saveDay() {
  if (!day.value || !isDirty.value || isReadOnly.value || isSaving.value) return
  isSaving.value = true
  if (!saveConflict.value) saveError.value = ''
  saveSuccess.value = ''
  const requestSemesterId = selectedSemesterId.value
  const requestDate = selectedDate.value
  const entries = day.value.roster
    .filter((member) => draft[member.id] !== member.status)
    .map((member) => ({ membershipId: member.id, status: draft[member.id] ?? null }))
  try {
    const result = await $fetch<AttendanceDay>(`/api/attendance/${encodeURIComponent(requestSemesterId)}/${encodeURIComponent(requestDate)}`, {
      method: 'PUT',
      body: { revision: day.value.revision, entries },
    })
    if (requestSemesterId !== selectedSemesterId.value || requestDate !== selectedDate.value) return
    copyServerDay(result)
    saveConflict.value = false
    saveError.value = ''
    saveSuccess.value = `Absensi berhasil disimpan. ${result.unfilledCount} siswa belum diisi.`
  } catch (error) {
    const candidate = error as { statusCode?: number; status?: number }
    saveConflict.value = saveConflict.value || candidate.statusCode === 409 || candidate.status === 409
    saveError.value = getApiMessage(error, 'Absensi belum berhasil disimpan. Perubahan tetap tersedia untuk dicoba kembali.')
  } finally {
    isSaving.value = false
  }
}

async function reloadAfterConflict() {
  if (!window.confirm('Muat ulang data terbaru? Perubahan absensi yang belum disimpan akan dibuang.')) return
  await loadDay()
}

async function toggleHistory() {
  if (!day.value?.semester) return
  if (historyOpen.value) {
    historyOpen.value = false
    return
  }
  historyOpen.value = true
  historyLoading.value = true
  historyError.value = ''
  const requestSequence = ++historyRequestSequence
  const requestSemesterId = selectedSemesterId.value
  const requestDate = selectedDate.value
  try {
    const result = await $fetch<{ history: AttendanceHistoryItem[] }>('/api/attendance/history', {
      query: { semesterId: requestSemesterId, date: requestDate },
    })
    if (requestSequence === historyRequestSequence
      && requestSemesterId === selectedSemesterId.value
      && requestDate === selectedDate.value) history.value = result.history
  } catch (error) {
    if (requestSequence === historyRequestSequence
      && requestSemesterId === selectedSemesterId.value
      && requestDate === selectedDate.value) {
      historyError.value = getApiMessage(error, 'Riwayat absensi belum dapat dimuat. Coba lagi.')
    }
  } finally {
    if (requestSequence === historyRequestSequence) historyLoading.value = false
  }
}

function formatDate(date: string): string {
  const [year = 1, month = 1, dayNumber = 1] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, dayNumber)))
}

function formatTime(timestamp: string): string {
  const dateValue = new Date(timestamp)
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: day.value?.school?.timeZone ?? 'Asia/Jakarta' }).format(dateValue)
}

function statusLabel(status: AttendanceStatus | null): string {
  return statusChoices.find((choice) => choice.value === status)?.label ?? 'Belum diisi'
}

let beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | undefined
onMounted(() => {
  beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (!isDirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', beforeUnloadHandler)
})
onBeforeUnmount(() => {
  if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler)
})
onBeforeRouteLeave(() => {
  if (isSaving.value) {
    saveError.value = 'Absensi sedang disimpan. Tunggu hasilnya sebelum berpindah halaman.'
    return false
  }
  if (!isDirty.value) return true
  return window.confirm('Perubahan absensi belum disimpan. Tinggalkan halaman dan buang perubahan ini?')
})
</script>

<template>
  <main class="page-content attendance-page">
    <section class="page-heading">
      <p class="eyebrow">Ruang guru</p>
      <h1>Absensi harian</h1>
      <p>Pilih tanggal sekolah, tentukan status setiap siswa, lalu simpan perubahan secara manual.</p>
    </section>

    <section v-if="semesterLoadError" class="content-card empty-state attendance-empty">
      <span class="empty-state-icon" aria-hidden="true">!</span>
      <h2>Daftar semester belum tersedia</h2>
      <p>{{ semesterLoadError }}</p>
      <button class="secondary-button attendance-empty-link" type="button" :disabled="semesterLoading" @click="retrySemesterLoad">
        {{ semesterLoading ? 'Memuat…' : 'Coba lagi' }}
      </button>
    </section>

    <section v-else-if="!semesters.length" class="content-card empty-state attendance-empty">
      <span class="empty-state-icon" aria-hidden="true">✓</span>
      <h2>Belum ada semester</h2>
      <p>Buat semester dan atur kalender sekolah sebelum mengisi absensi.</p>
      <NuxtLink class="secondary-button attendance-empty-link" to="/semesters">Kelola semester</NuxtLink>
    </section>

    <template v-else>
      <section class="content-card attendance-controls" aria-label="Pilih semester dan tanggal">
        <div class="form-field">
          <label for="attendance-semester">Semester</label>
          <select id="attendance-semester" :value="selectedSemesterId" :disabled="dayLoading || isSaving" @change="changeSemester">
            <option v-for="semester in semesters" :key="semester.id" :value="semester.id">{{ semesterLabel(semester) }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="attendance-date">Tanggal absensi</label>
          <input
            id="attendance-date"
            type="date"
            :min="selectedSemester?.startsOn"
            :max="dateMax"
            :value="selectedDate"
            :disabled="dayLoading || isSaving || !selectedSemester"
            @change="changeDate"
          >
        </div>
        <p v-if="selectedSemester" class="field-help attendance-period">
          Periode {{ selectedSemester.startsOn }} sampai {{ selectedSemester.endsOn }} · zona waktu {{ day?.school?.timeZone ?? 'sekolah' }}
        </p>
      </section>

      <div v-if="dayError" class="page-message form-error attendance-day-error" role="alert">
        <p>{{ dayError }}</p>
        <button class="text-button" type="button" :disabled="dayLoading" @click="loadDay">Coba muat ulang</button>
      </div>
      <p v-if="dayLoading" class="content-card attendance-loading" role="status">Memuat daftar siswa dan absensi…</p>

      <template v-if="day && !dayLoading">
        <section class="content-card attendance-summary">
          <div>
            <p class="eyebrow">{{ day.school?.name }} <span v-if="day.school?.className">· {{ day.school.className }}</span></p>
            <h2>{{ formatDate(day.date) }}</h2>
            <p>{{ semesterLabel(day.semester!) }}</p>
          </div>
          <span v-if="day.semester?.status === 'closed'" class="archive-badge">Arsip baca-saja</span>
          <span v-else-if="isDirty" class="attendance-dirty-badge">Belum disimpan</span>
          <span v-else class="active-badge">{{ day.historyCount ? 'Tersimpan' : 'Belum diisi' }}</span>
        </section>

        <section v-if="readOnlyMessage" class="attendance-readonly" role="status">
          <strong>{{ day.readOnlyReason === 'semester_closed' ? 'Semester arsip' : day.readOnlyReason === 'calendar_holiday' ? 'Hari libur' : 'Absensi belum dapat diisi' }}</strong>
          <span>{{ readOnlyMessage }}</span>
        </section>

        <section v-if="day.roster.length" class="content-card attendance-card">
          <header class="attendance-toolbar">
            <div>
              <h2>Daftar siswa</h2>
              <p>{{ pendingCount }} belum diisi · H {{ statusCounts.H }} · S {{ statusCounts.S }} · I {{ statusCounts.I }} · A {{ statusCounts.A }}</p>
            </div>
            <button class="secondary-button attendance-mark-all" type="button" :disabled="isReadOnly || isSaving || dayLoading" @click="markAllPresent">
              Tandai semua hadir
            </button>
          </header>

          <div class="attendance-table-wrap">
            <table class="attendance-table">
              <thead>
                <tr><th scope="col">Siswa</th><th scope="col">Status absensi</th></tr>
              </thead>
              <tbody>
                <tr v-for="student in day.roster" :key="student.id">
                  <th scope="row" class="attendance-student">
                    <strong>{{ student.name }}</strong>
                    <small>{{ student.studentNumber || 'Tanpa NIPD' }}</small>
                  </th>
                  <td>
                    <div class="attendance-choices" role="group" :aria-label="`Status ${student.name}`">
                      <button
                        v-for="choice in statusChoices"
                        :key="choice.short"
                        type="button"
                        :class="{ 'attendance-choice-selected': draft[student.id] === choice.value }"
                        :aria-pressed="draft[student.id] === choice.value"
                        :aria-label="`${choice.label} untuk ${student.name}`"
                        :disabled="isReadOnly || isSaving || dayLoading"
                        @click="selectStatus(student.id, choice.value)"
                      >
                        <span>{{ choice.short }}</span><small>{{ choice.label }}</small>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!isReadOnly && isDirty" class="attendance-draft-note" role="status">
            Perubahan belum disimpan. Tombol “Tandai semua hadir” hanya mengubah pilihan di layar.
          </div>
          <div v-if="saveError" class="attendance-feedback attendance-feedback-error" role="alert">
            <p>{{ saveError }}</p>
            <button v-if="saveConflict" class="text-button" type="button" @click="reloadAfterConflict">Muat ulang data terbaru</button>
          </div>
          <p v-if="saveSuccess" class="attendance-feedback attendance-feedback-success" role="status">{{ saveSuccess }}</p>

          <footer class="attendance-actions">
            <span v-if="day.historyCount" class="attendance-history-count">{{ day.historyCount }} catatan absensi tersimpan</span>
            <button class="primary-button" type="button" :disabled="!isDirty || isReadOnly || isSaving || dayLoading" @click="saveDay">
              {{ isSaving ? 'Menyimpan…' : 'Simpan absensi' }}
            </button>
          </footer>
        </section>
        <section v-else class="content-card empty-state attendance-empty">
          <h2>Belum ada siswa pada tanggal ini</h2>
          <p>Daftar ini mengikuti tanggal masuk dan keluar yang tercatat untuk setiap siswa.</p>
        </section>

        <section class="content-card attendance-history-card">
          <div class="attendance-history-heading">
            <div>
              <h2>Riwayat perubahan</h2>
              <p>Catatan yang dikecualikan tetap tersimpan dan tidak dihitung dalam absensi hari sekolah.</p>
            </div>
            <button class="secondary-button" type="button" :disabled="historyLoading" @click="toggleHistory">
              {{ historyOpen ? 'Tutup riwayat' : 'Lihat riwayat' }}
            </button>
          </div>
          <p v-if="historyError" class="page-message form-error" role="alert">{{ historyError }}</p>
          <p v-else-if="historyLoading" class="attendance-loading" role="status">Memuat riwayat…</p>
          <ul v-else-if="historyOpen && history?.length" class="attendance-history-list">
            <li v-for="item in history" :key="item.id">
              <strong>{{ item.studentName }}</strong>
              <span>{{ statusLabel(item.statusBefore) }} → {{ statusLabel(item.statusAfter) }}</span>
              <small>{{ formatTime(item.occurredAt) }} · {{ item.actorKind === 'teacher' ? 'Perubahan guru' : 'Catatan sistem' }}</small>
              <small v-if="!item.isEffective">Tidak dihitung{{ item.exclusionReason === 'calendar_holiday' ? ' saat tanggal libur' : item.exclusionReason === 'manual_clear' ? ' karena status dikosongkan' : '' }}.</small>
            </li>
          </ul>
          <p v-else-if="historyOpen" class="attendance-history-empty">Belum ada perubahan absensi untuk tanggal ini.</p>
        </section>
      </template>
    </template>
  </main>
</template>
