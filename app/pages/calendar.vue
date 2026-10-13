<script setup lang="ts">
import { getApiFieldErrors, getApiMessage } from '../utils/api-errors.ts'

type CalendarExceptionKind = 'holiday' | 'school_day'

interface CalendarDay {
  date: string
  dayOfWeek: number
  routineConfigured: boolean
  isSchoolDay: boolean
  exceptionKind: CalendarExceptionKind | null
  note: string | null
  attendanceHistoryCount: number
  effectiveAttendanceCount: number
}

interface CalendarView {
  school: { id: string; name: string; timeZone: string; className: string } | null
  semester: {
    id: string
    academicYear: string
    term: 'ganjil' | 'genap'
    startsOn: string
    endsOn: string
    status: 'active'
  } | null
  schoolLocalToday: string | null
  month: string | null
  routineRules: Array<{ dayOfWeek: number; effectiveFrom: string; isSchoolDay: boolean }>
  days: CalendarDay[]
}

interface AttendanceImpact {
  attendanceHistoryCount: number
  effectiveAttendanceCount: number
}

interface ConfirmationPreview {
  kind: CalendarExceptionKind
  impact: AttendanceImpact
  previewToken: string
  changed: boolean
}

const weekdays = [
  { value: 0, short: 'Min', full: 'Minggu' },
  { value: 1, short: 'Sen', full: 'Senin' },
  { value: 2, short: 'Sel', full: 'Selasa' },
  { value: 3, short: 'Rab', full: 'Rabu' },
  { value: 4, short: 'Kam', full: 'Kamis' },
  { value: 5, short: 'Jum', full: 'Jumat' },
  { value: 6, short: 'Sab', full: 'Sabtu' },
]

const requestFetch = useRequestFetch()
const initialCalendar = await requestFetch<CalendarView>('/api/calendar').catch(() => null)
const calendar = ref<CalendarView | null>(initialCalendar)
const hasLoaded = ref(initialCalendar !== null)
const isLoading = ref(false)
const pageError = ref(initialCalendar ? '' : 'Kalender belum dapat dimuat. Coba lagi.')
const successMessage = ref('')
const selectedMonth = ref(initialCalendar?.month ?? '')
const selectedDate = ref('')
const routineForm = reactive({ effectiveFrom: '', schoolDays: [] as number[] })
const routineTouched = ref(false)
const routineSavedFrom = ref('')
const routineSavedDays = ref<number[]>([])
const routineSaving = ref(false)
const routineError = ref('')
const routineFieldErrors = ref<Record<string, string>>({})
const exceptionKind = ref<CalendarExceptionKind | ''>('')
const exceptionNote = ref('')
const exceptionSaving = ref(false)
const exceptionError = ref('')
const exceptionFieldErrors = ref<Record<string, string>>({})
const confirmationPreview = ref<ConfirmationPreview | null>(null)

const dayByDate = computed(() => new Map((calendar.value?.days ?? []).map((day) => [day.date, day])))
const selectedDay = computed(() => dayByDate.value.get(selectedDate.value) ?? null)
const selectedRoutine = computed(() => routineForDate(routineForm.effectiveFrom))

function isoDate(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatDate(date: string): string {
  const [year = 1, month = 1, day = 1] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function monthLabel(month: string): string {
  const [year = 1, number = 1] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, number - 1, 1)))
}

function monthOffset(month: string, delta: number): string {
  const [year = 1, number = 1] = month.split('-').map(Number)
  return isoDate(year, number - 1 + delta, 1).slice(0, 7)
}

function routineForDate(date: string): { configured: boolean; schoolDays: number[] } {
  const rules = calendar.value?.routineRules ?? []
  const schoolDays: number[] = []
  let configured = false
  for (const weekday of weekdays) {
    const applicable = rules
      .filter((rule) => rule.dayOfWeek === weekday.value && rule.effectiveFrom <= date)
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    if (applicable) {
      configured = true
      if (applicable.isSchoolDay) schoolDays.push(weekday.value)
    }
  }
  return { configured, schoolDays }
}

function defaultRoutineDate(data: CalendarView): string {
  const semester = data.semester
  if (!semester) return ''
  const today = data.schoolLocalToday ?? semester.startsOn
  return today < semester.startsOn ? semester.startsOn : today > semester.endsOn ? semester.endsOn : today
}

function applyCalendar(data: CalendarView) {
  calendar.value = data
  hasLoaded.value = true
  selectedMonth.value = data.month ?? selectedMonth.value
  if (!data.semester) {
    selectedDate.value = ''
    routineForm.effectiveFrom = ''
    routineForm.schoolDays = []
    return
  }

  if (!selectedDate.value || !dayByDate.value.has(selectedDate.value)) {
    const preferred = data.days.find((day) => day.date === data.schoolLocalToday)
    selectedDate.value = preferred?.date ?? data.days[0]?.date ?? ''
  }
  if (!routineForm.effectiveFrom || routineForm.effectiveFrom < data.semester.startsOn || routineForm.effectiveFrom > data.semester.endsOn) {
    routineForm.effectiveFrom = defaultRoutineDate(data)
    routineTouched.value = false
  }
  if (!routineTouched.value) {
    const saved = routineForDate(routineForm.effectiveFrom).schoolDays
    routineForm.schoolDays = saved
    if (!routineSavedFrom.value) {
      routineSavedFrom.value = routineForm.effectiveFrom
      routineSavedDays.value = [...saved]
    } else if (routineSavedFrom.value === routineForm.effectiveFrom) {
      routineSavedDays.value = [...saved]
    }
  }
}

if (initialCalendar) applyCalendar(initialCalendar)
watch(selectedDate, (date) => {
  const day = dayByDate.value.get(date)
  exceptionKind.value = day?.exceptionKind ?? ''
  exceptionNote.value = day?.note ?? ''
  exceptionError.value = ''
  exceptionFieldErrors.value = {}
  confirmationPreview.value = null
}, { immediate: true })

watch(() => routineForm.effectiveFrom, (date) => {
  if (!date || routineTouched.value) return
  routineForm.schoolDays = routineForDate(date).schoolDays
})

const calendarCells = computed(() => {
  const month = selectedMonth.value
  if (!month) return []
  const [year = 1, monthNumber = 1] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const gridStart = new Date(Date.UTC(year, monthNumber - 1, 1 - first.getUTCDay()))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * 86_400_000)
    const iso = isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    return {
      date: iso,
      number: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthNumber - 1,
      day: dayByDate.value.get(iso) ?? null,
    }
  })
})

const firstSemesterMonth = computed(() => calendar.value?.semester?.startsOn.slice(0, 7) ?? '')
const lastSemesterMonth = computed(() => calendar.value?.semester?.endsOn.slice(0, 7) ?? '')
const canGoPreviousMonth = computed(() => Boolean(selectedMonth.value && selectedMonth.value > firstSemesterMonth.value))
const canGoNextMonth = computed(() => Boolean(selectedMonth.value && selectedMonth.value < lastSemesterMonth.value))
const routineHasChanges = computed(() => Boolean(routineForm.effectiveFrom)
  && (routineForm.effectiveFrom !== routineSavedFrom.value
    || routineForm.schoolDays.length !== routineSavedDays.value.length
    || routineForm.schoolDays.some((day, index) => day !== routineSavedDays.value[index])))
const routineCanSave = computed(() => routineHasChanges.value && (selectedRoutine.value.configured || routineTouched.value))
const calendarMutationBusy = computed(() => routineSaving.value || exceptionSaving.value)
const exceptionHasChanges = computed(() => Boolean(exceptionKind.value)
  && (exceptionKind.value !== (selectedDay.value?.exceptionKind ?? '')
    || exceptionNote.value.trim() !== (selectedDay.value?.note ?? '')))

function statusLabel(day: CalendarDay): string {
  if (day.exceptionKind === 'holiday') return 'Libur'
  if (day.exceptionKind === 'school_day') return 'Hari khusus'
  if (!day.routineConfigured) return 'Belum diatur'
  return day.isSchoolDay ? 'Hari sekolah' : 'Libur rutin'
}

function statusClass(day: CalendarDay): string {
  if (day.exceptionKind === 'holiday' || (day.routineConfigured && !day.isSchoolDay && !day.exceptionKind)) return 'calendar-day-holiday'
  if (day.exceptionKind === 'school_day' || day.isSchoolDay) return 'calendar-day-school'
  return 'calendar-day-unset'
}

async function loadCalendar(month = selectedMonth.value) {
  isLoading.value = true
  pageError.value = ''
  try {
    const data = await $fetch<CalendarView>('/api/calendar', { query: month ? { month } : undefined })
    applyCalendar(data)
    return true
  } catch (error) {
    pageError.value = getApiMessage(error, 'Kalender belum dapat dimuat. Coba lagi.')
    return false
  } finally {
    isLoading.value = false
  }
}

async function changeMonth(delta: number) {
  if (calendarMutationBusy.value || isLoading.value) return
  const next = monthOffset(selectedMonth.value, delta)
  if ((delta < 0 && !canGoPreviousMonth.value) || (delta > 0 && !canGoNextMonth.value)) return
  await loadCalendar(next)
}

function toggleRoutineDay(day: number, checked: boolean) {
  const next = new Set(routineForm.schoolDays)
  if (checked) next.add(day)
  else next.delete(day)
  routineForm.schoolDays = [...next].sort((left, right) => left - right)
  routineTouched.value = true
  routineError.value = ''
}

function markEveryDayOff() {
  routineForm.schoolDays = []
  routineTouched.value = true
  routineError.value = ''
}

async function saveRoutine() {
  if (routineSaving.value || !routineCanSave.value) return
  routineSaving.value = true
  routineError.value = ''
  routineFieldErrors.value = {}
  successMessage.value = ''
  try {
    const saved = await $fetch<{ rules: Array<{ dayOfWeek: number; effectiveFrom: string; isSchoolDay: boolean }> }>('/api/calendar/routine', {
      method: 'PUT',
      body: { effectiveFrom: routineForm.effectiveFrom, schoolDays: routineForm.schoolDays },
    })
    routineSavedFrom.value = routineForm.effectiveFrom
    routineSavedDays.value = saved.rules.filter((rule) => rule.isSchoolDay).map((rule) => rule.dayOfWeek).sort((left, right) => left - right)
    routineTouched.value = false
    successMessage.value = `Aturan hari sekolah berlaku mulai ${formatDate(routineForm.effectiveFrom)}.`
    await loadCalendar(selectedMonth.value)
  } catch (error) {
    routineFieldErrors.value = getApiFieldErrors(error)
    routineError.value = getApiMessage(error, 'Perubahan hari rutin belum tersimpan. Periksa tanggal dan absensi lalu coba lagi.')
  } finally {
    routineSaving.value = false
  }
}

function responseData(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null
  const outer = (error as { data?: unknown }).data
  if (typeof outer !== 'object' || outer === null || !('data' in outer)) return null
  const inner = (outer as { data?: unknown }).data
  return typeof inner === 'object' && inner !== null ? inner as Record<string, unknown> : null
}

function readImpact(value: unknown): AttendanceImpact | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.attendanceHistoryCount !== 'number' || typeof candidate.effectiveAttendanceCount !== 'number') return null
  return {
    attendanceHistoryCount: candidate.attendanceHistoryCount,
    effectiveAttendanceCount: candidate.effectiveAttendanceCount,
  }
}

async function saveException(previewToken?: string) {
  if (exceptionSaving.value || !selectedDate.value || !exceptionKind.value) return
  const requestDate = selectedDate.value
  const requestKind = exceptionKind.value
  const requestNote = exceptionNote.value
  const previousKind = selectedDay.value?.exceptionKind
  exceptionSaving.value = true
  exceptionError.value = ''
  exceptionFieldErrors.value = {}
  successMessage.value = ''
  try {
    const result = await $fetch<{
      exception: { kind: CalendarExceptionKind }
      impact: AttendanceImpact
      excludedAttendanceCount: number
    }>(`/api/calendar/exceptions/${encodeURIComponent(requestDate)}`, {
      method: 'PUT',
      body: { kind: requestKind, note: requestNote, ...(previewToken ? { previewToken } : {}) },
    })
    confirmationPreview.value = null
    if (result.exception.kind === 'school_day' && previousKind === 'holiday' && result.impact.attendanceHistoryCount > 0) {
      successMessage.value = 'Tanggal kembali menjadi hari sekolah. Absensi lama tetap menjadi riwayat dan tidak dipulihkan; isi absensi baru untuk tanggal ini.'
    } else if (result.excludedAttendanceCount > 0) {
      successMessage.value = `${result.excludedAttendanceCount} catatan efektif dikeluarkan dari perhitungan. Riwayatnya tetap tersimpan.`
    } else {
      successMessage.value = 'Perubahan kalender tersimpan.'
    }
    await loadCalendar(selectedMonth.value)
  } catch (error) {
    const data = responseData(error)
    const reason = data?.reason
    const impact = readImpact(data?.impact)
    const token = typeof data?.previewToken === 'string' ? data.previewToken : ''
    if ((reason === 'attendance_confirmation_required' || reason === 'preview_changed') && impact && token) {
      confirmationPreview.value = {
        kind: requestKind,
        impact,
        previewToken: token,
        changed: reason === 'preview_changed',
      }
      return
    }
    exceptionFieldErrors.value = getApiFieldErrors(error)
    exceptionError.value = getApiMessage(error, 'Pengecualian tanggal belum tersimpan. Periksa kembali lalu coba lagi.')
  } finally {
    exceptionSaving.value = false
  }
}

function cancelConfirmation() {
  if (exceptionSaving.value) return
  confirmationPreview.value = null
}
</script>

<template>
  <main class="page-content calendar-page">
    <section class="page-heading calendar-heading">
      <div>
        <p class="eyebrow">Hari sekolah</p>
        <h1>Kalender sekolah</h1>
        <p v-if="calendar?.school">{{ calendar.school.name }} · {{ calendar.school.className || 'Kelas belum disiapkan' }}</p>
        <p v-else>Atur hari sekolah untuk semester aktif. Tanggal yang belum diatur tidak otomatis dianggap hari sekolah.</p>
      </div>
      <div v-if="calendar?.semester" class="calendar-semester-badge">
        <strong>{{ calendar.semester.term === 'ganjil' ? 'Ganjil' : 'Genap' }} {{ calendar.semester.academicYear }}</strong>
        <span>{{ formatDate(calendar.semester.startsOn) }} — {{ formatDate(calendar.semester.endsOn) }}</span>
      </div>
    </section>

    <p v-if="pageError" class="form-error page-message" role="alert">
      {{ pageError }}
      <button class="text-button" type="button" @click="loadCalendar()">Coba lagi</button>
    </p>
    <p v-if="successMessage" class="success-message page-message" role="status">{{ successMessage }}</p>

    <section v-if="!hasLoaded && !pageError" class="content-card calendar-empty" role="status">
      <p>Memuat kalender…</p>
    </section>
    <section v-else-if="hasLoaded && !calendar?.school" class="content-card calendar-empty" aria-labelledby="calendar-school-missing-title">
      <span class="calendar-empty-icon" aria-hidden="true">▦</span>
      <h2 id="calendar-school-missing-title">Data sekolah belum tersedia</h2>
      <p>Siapkan nama sekolah, kelas, dan zona waktunya sebelum mengatur kalender.</p>
      <NuxtLink class="primary-button calendar-empty-link" to="/school">Atur data sekolah</NuxtLink>
    </section>
    <section v-else-if="hasLoaded && !calendar?.semester" class="content-card calendar-empty" aria-labelledby="calendar-semester-missing-title">
      <span class="calendar-empty-icon" aria-hidden="true">▦</span>
      <h2 id="calendar-semester-missing-title">Belum ada semester aktif</h2>
      <p>Buat semester aktif terlebih dahulu sebelum mengatur kalender. Perubahan pada semester yang sudah ditutup tidak dapat dilakukan.</p>
      <NuxtLink class="primary-button calendar-empty-link" to="/semesters">Kelola semester</NuxtLink>
    </section>

    <template v-else-if="calendar?.semester">
      <section class="calendar-layout" aria-label="Kalender semester aktif">
        <div class="calendar-main-column">
          <section class="content-card month-card" aria-labelledby="calendar-month-title" :aria-busy="isLoading || calendarMutationBusy">
            <header class="month-heading">
              <button class="secondary-button month-step" type="button" :disabled="!canGoPreviousMonth || isLoading || calendarMutationBusy" aria-label="Bulan sebelumnya" @click="changeMonth(-1)">‹</button>
              <div>
                <h2 id="calendar-month-title">{{ monthLabel(selectedMonth) }}</h2>
                <p>Pilih tanggal untuk melihat atau mengatur pengecualian.</p>
              </div>
              <button class="secondary-button month-step" type="button" :disabled="!canGoNextMonth || isLoading || calendarMutationBusy" aria-label="Bulan berikutnya" @click="changeMonth(1)">›</button>
            </header>

            <div class="calendar-grid" role="grid" aria-labelledby="calendar-month-title">
              <div v-for="weekday in weekdays" :key="weekday.value" class="calendar-weekday" role="columnheader" :aria-label="weekday.full">
                {{ weekday.short }}
              </div>
              <div
                v-for="cell in calendarCells"
                :key="cell.date"
                class="calendar-grid-cell"
                role="gridcell"
                :aria-selected="selectedDate === cell.date"
              >
                <button
                  class="calendar-day"
                  :class="[
                    { 'calendar-day-outside': !cell.inMonth, 'calendar-day-selected': selectedDate === cell.date },
                    cell.day ? statusClass(cell.day) : 'calendar-day-outside-period',
                  ]"
                  type="button"
                  :disabled="!cell.day || isLoading || calendarMutationBusy"
                  :aria-label="cell.day ? `${formatDate(cell.date)}, ${statusLabel(cell.day)}` : `${formatDate(cell.date)}, di luar periode semester`"
                  :aria-pressed="selectedDate === cell.date"
                  @click="selectedDate = cell.date"
                >
                  <span class="calendar-day-number">{{ cell.number }}</span>
                  <span v-if="cell.day" class="calendar-day-label">{{ statusLabel(cell.day) }}</span>
                </button>
              </div>
            </div>

            <div class="calendar-legend" aria-label="Keterangan kalender">
              <span><i class="legend-dot legend-school" aria-hidden="true" /> Hari sekolah</span>
              <span><i class="legend-dot legend-holiday" aria-hidden="true" /> Libur</span>
              <span><i class="legend-dot legend-unset" aria-hidden="true" /> Belum diatur</span>
            </div>
          </section>

          <section v-if="selectedDay" class="content-card exception-card" aria-labelledby="exception-title">
            <div class="calendar-section-heading">
              <div>
                <p class="eyebrow">Pengecualian tanggal</p>
                <h2 id="exception-title">{{ formatDate(selectedDate) }}</h2>
              </div>
              <span class="day-status-badge" :class="statusClass(selectedDay)">{{ statusLabel(selectedDay) }}</span>
            </div>

            <p v-if="selectedDay.attendanceHistoryCount" class="attendance-count-note" role="status">
              {{ selectedDay.attendanceHistoryCount }} catatan absensi tersimpan; {{ selectedDay.effectiveAttendanceCount }} masih dihitung.
            </p>
            <p v-if="selectedDay.exceptionKind === 'holiday' && selectedDay.attendanceHistoryCount" class="history-note">
              Catatan pada hari libur tetap menjadi riwayat dan tidak masuk perhitungan.
            </p>

            <p v-if="exceptionError" class="form-error calendar-form-error" role="alert">{{ exceptionError }}</p>
            <form class="exception-form" @submit.prevent="saveException()">
              <fieldset class="exception-kind-picker">
                <legend>Jenis hari</legend>
                <label class="exception-choice" :class="{ 'exception-choice-selected': exceptionKind === 'holiday' }">
                  <input v-model="exceptionKind" type="radio" value="holiday" :disabled="exceptionSaving">
                  <span><strong>Hari libur</strong><small>Tidak dihitung sebagai hari sekolah.</small></span>
                </label>
                <label class="exception-choice" :class="{ 'exception-choice-selected': exceptionKind === 'school_day' }">
                  <input v-model="exceptionKind" type="radio" value="school_day" :disabled="exceptionSaving">
                  <span><strong>Hari sekolah khusus</strong><small>Menggantikan aturan rutin pada tanggal ini.</small></span>
                </label>
              </fieldset>

              <div class="form-field exception-note-field">
                <label for="calendar-exception-note">Catatan <span class="optional-label">(opsional)</span></label>
                <textarea
                  id="calendar-exception-note"
                  v-model="exceptionNote"
                  rows="3"
                  maxlength="240"
                  placeholder="Contoh: Hari libur sekolah"
                  :disabled="exceptionSaving"
                  :aria-invalid="Boolean(exceptionFieldErrors.note)"
                />
                <p v-if="exceptionFieldErrors.note" class="field-error">{{ exceptionFieldErrors.note }}</p>
                <p v-else class="field-help">Maksimal 240 karakter.</p>
              </div>

              <p v-if="exceptionKind === 'school_day' && selectedDay.exceptionKind === 'holiday' && selectedDay.attendanceHistoryCount" class="history-note">
                Absensi lama tidak dipulihkan saat tanggal kembali menjadi hari sekolah. Guru perlu mengisi absensi baru.
              </p>
              <button class="primary-button exception-save-button" type="submit" :disabled="!exceptionHasChanges || exceptionSaving">
                {{ exceptionSaving ? 'Menyimpan…' : 'Simpan pengecualian' }}
              </button>
            </form>
          </section>
        </div>

        <aside class="calendar-side-column">
          <section class="content-card routine-card" aria-labelledby="routine-title">
            <div class="calendar-section-heading">
              <div>
                <p class="eyebrow">Aturan rutin</p>
                <h2 id="routine-title">Hari sekolah mingguan</h2>
              </div>
            </div>
            <p class="routine-intro">Aturan berlaku mulai tanggal yang dipilih dan mengisi hari yang belum memiliki catatan absensi. Absensi lama dan semester tertutup tidak diubah.</p>

            <div v-if="!selectedRoutine.configured" class="routine-unset-note" role="status">
              Belum ada aturan rutin pada tanggal ini. Kalender yang belum diatur tidak dianggap Senin–Jumat.
            </div>
            <p v-if="routineTouched && selectedRoutine.configured" class="routine-preserved-note" role="status">
              Pilihan hari yang belum disimpan tetap dipertahankan saat tanggal mulai berubah.
            </p>

            <div class="form-field routine-date-field">
              <label for="routine-effective-from">Berlaku mulai</label>
              <input
                id="routine-effective-from"
                v-model="routineForm.effectiveFrom"
                type="date"
                :min="calendar.semester.startsOn"
                :max="calendar.semester.endsOn"
                :disabled="routineSaving"
                :aria-invalid="Boolean(routineFieldErrors.effectiveFrom)"
              >
              <p v-if="routineFieldErrors.effectiveFrom" class="field-error">{{ routineFieldErrors.effectiveFrom }}</p>
            </div>

            <fieldset class="weekday-picker">
              <legend>Pilih hari sekolah</legend>
              <label v-for="weekday in weekdays" :key="weekday.value" class="weekday-option" :class="{ 'weekday-option-selected': routineForm.schoolDays.includes(weekday.value) }">
                <input
                  type="checkbox"
                  :checked="routineForm.schoolDays.includes(weekday.value)"
                  :disabled="routineSaving"
                  @change="toggleRoutineDay(weekday.value, ($event.target as HTMLInputElement).checked)"
                >
                <span>{{ weekday.full }}</span>
              </label>
            </fieldset>

            <p v-if="routineForm.schoolDays.length === 0" class="all-off-note">Belum ada hari dipilih. Simpan sebagai libur untuk semua hari hanya jika itu memang yang diinginkan.</p>
            <p v-if="routineFieldErrors.schoolDays" class="field-error">{{ routineFieldErrors.schoolDays }}</p>
            <p v-if="routineError" class="form-error calendar-form-error" role="alert">{{ routineError }}</p>
            <div class="routine-actions">
              <button class="secondary-button" type="button" :disabled="routineSaving" @click="markEveryDayOff">Liburkan semua hari</button>
              <button class="primary-button" type="button" :disabled="!routineCanSave || routineSaving" @click="saveRoutine">
                {{ routineSaving ? 'Menyimpan…' : 'Simpan aturan rutin' }}
              </button>
            </div>
          </section>

          <section class="calendar-help-panel" aria-label="Catatan kalender">
            <strong>Belum diatur berbeda dengan libur.</strong>
            <p>Setiap aturan menyimpan pilihan untuk ketujuh hari. Absensi lama tetap menjadi riwayat ketika kalender berubah.</p>
          </section>
        </aside>
      </section>
    </template>

    <div v-if="confirmationPreview" class="dialog-backdrop" @click.self="cancelConfirmation">
      <section class="calendar-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-confirm-title" aria-describedby="calendar-confirm-description">
        <div class="calendar-confirm-heading">
          <div>
            <p class="eyebrow">Periksa dampak terbaru</p>
            <h2 id="calendar-confirm-title">Ubah jenis hari?</h2>
          </div>
          <button class="dialog-dismiss" type="button" aria-label="Tutup konfirmasi" :disabled="exceptionSaving" @click="cancelConfirmation">×</button>
        </div>
        <p id="calendar-confirm-description" class="calendar-confirm-date">{{ formatDate(selectedDate) }} · {{ confirmationPreview.kind === 'holiday' ? 'Hari libur' : 'Hari sekolah khusus' }}</p>
        <p v-if="confirmationPreview.changed" class="calendar-confirm-changed" role="status">
          Jumlah berubah sejak pemeriksaan sebelumnya. Periksa angka terbaru sebelum melanjutkan.
        </p>
        <dl class="calendar-confirm-counts">
          <div><dt>Catatan tersimpan sebagai riwayat</dt><dd>{{ confirmationPreview.impact.attendanceHistoryCount }}</dd></div>
          <div><dt>Masih dihitung saat ini</dt><dd>{{ confirmationPreview.impact.effectiveAttendanceCount }}</dd></div>
        </dl>
        <p v-if="confirmationPreview.kind === 'holiday'" class="calendar-confirm-copy">
          Catatan yang masih dihitung akan dikeluarkan dari perhitungan. Semua catatan lama tetap tersimpan sebagai riwayat.
        </p>
        <p v-else class="calendar-confirm-copy">
          Kalender tidak akan memulihkan absensi lama. Tanggal akan kosong sampai guru mengisi absensi baru.
        </p>
        <div class="calendar-confirm-actions">
          <button class="secondary-button" type="button" :disabled="exceptionSaving" @click="cancelConfirmation">Batal</button>
          <button class="close-semester-button" type="button" :disabled="exceptionSaving" @click="saveException(confirmationPreview.previewToken)">
            {{ exceptionSaving ? 'Memeriksa…' : 'Konfirmasi perubahan' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.calendar-page { max-width: 1320px; }
.calendar-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.calendar-semester-badge { display: grid; gap: 5px; padding: 12px 16px; color: #28624e; background: #e9f4ee; border-radius: 12px; font-size: 13px; }
.calendar-semester-badge span { color: #536b65; font-size: 12px; }
.calendar-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .85fr); align-items: start; gap: 20px; }
.calendar-main-column, .calendar-side-column { display: grid; align-content: start; gap: 20px; min-width: 0; }
.month-card, .exception-card, .routine-card { padding: clamp(19px, 3vw, 29px); }
.month-heading { display: grid; grid-template-columns: 46px minmax(0, 1fr) 46px; align-items: center; gap: 14px; margin-bottom: 22px; text-align: center; }
.month-heading h2 { margin: 0; font-size: 21px; text-transform: capitalize; }
.month-heading p { margin: 6px 0 0; color: #536b65; font-size: 13px; line-height: 1.45; }
.month-step { width: 44px; min-height: 44px; padding: 0; font-size: 28px; line-height: 1; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.calendar-weekday { padding: 4px 2px 9px; color: #657b75; font-size: 11px; font-weight: 700; text-align: center; }
.calendar-grid-cell { min-width: 0; }
.calendar-day { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; width: 100%; min-height: 82px; padding: 8px; color: #172d29; background: #fff; border: 1px solid #d8e4e0; border-radius: 10px; text-align: left; }
.calendar-day:hover:not(:disabled) { border-color: #78a99b; }
.calendar-day:focus-visible { outline: 3px solid #61a695; outline-offset: 1px; }
.calendar-day:disabled { cursor: default; }
.calendar-day-outside { visibility: hidden; }
.calendar-day-outside-period { color: #899a95; background: #f4f7f6; }
.calendar-day-selected { outline: 2px solid #126451; outline-offset: 1px; }
.calendar-day-school { background: #e9f5ed; border-color: #c9e2d1; }
.calendar-day-holiday { background: #fff4df; border-color: #ead7a8; }
.calendar-day-unset { background: #f4f7f6; border-color: #d8e4e0; }
.calendar-day-number { font-size: 14px; font-weight: 700; }
.calendar-day-label { display: block; margin-top: 8px; color: #536b65; font-size: 10px; line-height: 1.25; }
.calendar-legend { display: flex; flex-wrap: wrap; gap: 11px 18px; padding-top: 18px; color: #536b65; font-size: 12px; }
.calendar-legend span { display: inline-flex; align-items: center; gap: 7px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.legend-school { background: #5b9d76; }
.legend-holiday { background: #d4a43b; }
.legend-unset { background: #9aaba5; }
.calendar-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.calendar-section-heading h2 { margin: 5px 0 0; font-size: 19px; line-height: 1.3; }
.day-status-badge { display: inline-flex; align-items: center; min-height: 27px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.day-status-badge.calendar-day-school { color: #28624e; }
.day-status-badge.calendar-day-holiday { color: #795612; }
.day-status-badge.calendar-day-unset { color: #536b65; }
.attendance-count-note, .history-note, .routine-intro { margin: 15px 0 0; color: #536b65; font-size: 13px; line-height: 1.5; }
.history-note { padding: 11px 13px; color: #795612; background: #fff7e5; border-radius: 9px; }
.exception-form { display: grid; gap: 18px; margin-top: 19px; }
.exception-kind-picker, .weekday-picker { display: grid; gap: 9px; min-width: 0; margin: 0; padding: 0; border: 0; }
.exception-kind-picker legend, .weekday-picker legend { margin-bottom: 2px; font-size: 13px; font-weight: 700; }
.exception-choice { display: flex; align-items: flex-start; gap: 12px; min-height: 58px; padding: 13px; background: #fff; border: 1px solid #d8e4e0; border-radius: 10px; cursor: pointer; }
.exception-choice-selected { background: #e9f4ee; border-color: #126451; }
.exception-choice input { width: 17px; height: 17px; margin: 2px 0 0; accent-color: #126451; flex: 0 0 auto; }
.exception-choice strong, .exception-choice small { display: block; }
.exception-choice strong { font-size: 13px; }
.exception-choice small { margin-top: 4px; color: #536b65; font-size: 12px; line-height: 1.4; }
.exception-note-field { gap: 8px; }
.exception-note-field label, .routine-date-field label { font-size: 13px; font-weight: 700; }
.exception-note-field textarea, .routine-date-field input { width: 100%; min-height: 45px; padding: 11px 12px; color: #172d29; background: #fff; border: 1px solid #cddbd7; border-radius: 9px; font: inherit; font-size: 14px; resize: vertical; }
.exception-note-field textarea:focus-visible, .routine-date-field input:focus-visible { outline: 3px solid #61a695; outline-offset: 2px; }
.exception-note-field textarea[aria-invalid="true"], .routine-date-field input[aria-invalid="true"] { border-color: #ae3e36; }
.exception-save-button { width: 100%; margin: 0; }
.calendar-form-error { margin: 12px 0 0; }
.routine-card { display: grid; gap: 17px; }
.routine-intro { margin: -7px 0 0; }
.routine-unset-note, .routine-preserved-note, .all-off-note { padding: 11px 13px; color: #795612; background: #fff7e5; border-radius: 9px; font-size: 12px; line-height: 1.5; }
.routine-preserved-note { margin: -7px 0 0; }
.routine-date-field { gap: 8px; }
.weekday-picker { gap: 7px; }
.weekday-option { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 7px 10px; color: #536b65; border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-size: 13px; }
.weekday-option-selected { color: #205a43; background: #e9f5ed; border-color: #c9e2d1; font-weight: 700; }
.weekday-option input { width: 17px; height: 17px; margin: 0; accent-color: #126451; }
.all-off-note { margin: -5px 0 0; color: #536b65; background: #f4f7f6; }
.routine-actions { display: grid; gap: 9px; padding-top: 4px; }
.routine-actions .primary-button, .routine-actions .secondary-button { width: 100%; margin: 0; }
.calendar-help-panel { padding: 18px 20px; color: #41675c; background: #edf3f1; border-radius: 13px; font-size: 13px; line-height: 1.5; }
.calendar-help-panel p { margin: 7px 0 0; color: #536b65; }
.calendar-empty { max-width: 760px; margin: 0 auto; padding: 39px 24px; text-align: center; }
.calendar-empty-icon { display: inline-grid; place-items: center; width: 50px; height: 50px; margin-bottom: 14px; color: #126451; background: #e8f1ee; border-radius: 15px; font-size: 22px; }
.calendar-empty h2 { margin: 0; font-size: 19px; }
.calendar-empty p { max-width: 520px; margin: 9px auto 0; color: #536b65; font-size: 14px; line-height: 1.5; }
.calendar-empty-link { display: inline-grid; place-items: center; width: auto; min-width: 200px; margin-top: 20px; text-decoration: none; }
.calendar-confirm-dialog { width: min(100%, 560px); max-height: min(90svh, 780px); overflow-y: auto; padding: 29px 31px; background: #fff; border: 1px solid #d8e4e0; border-radius: 18px; box-shadow: 0 24px 80px rgb(0 0 0 / 18%); }
.calendar-confirm-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 13px; }
.calendar-confirm-heading h2 { margin: 5px 0 0; font-size: 23px; }
.calendar-confirm-date { margin: 14px 0 0; color: #536b65; font-size: 14px; }
.calendar-confirm-changed { margin: 15px 0 0; padding: 11px 13px; color: #795612; background: #fff7e5; border-radius: 9px; font-size: 13px; line-height: 1.45; }
.calendar-confirm-counts { display: grid; gap: 8px; margin: 18px 0 0; }
.calendar-confirm-counts > div { display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; background: #f4f7f6; border-radius: 9px; }
.calendar-confirm-counts dt { color: #536b65; font-size: 13px; }
.calendar-confirm-counts dd { margin: 0; font-size: 15px; font-weight: 700; }
.calendar-confirm-copy { margin: 17px 0 0; color: #536b65; font-size: 13px; line-height: 1.5; }
.calendar-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 23px; }
.calendar-confirm-actions .secondary-button, .calendar-confirm-actions .close-semester-button { min-width: 150px; min-height: 45px; }

@media (max-width: 900px) {
  .calendar-layout { grid-template-columns: minmax(0, 1fr); }
  .calendar-side-column { grid-row: 2; }
}

@media (max-width: 760px) {
  .calendar-heading { align-items: stretch; flex-direction: column; gap: 13px; }
  .calendar-semester-badge { justify-self: start; }
  .calendar-layout, .calendar-main-column, .calendar-side-column { gap: 14px; }
  .month-card, .exception-card, .routine-card { padding: 18px 14px; border-radius: 15px; }
  .month-heading { grid-template-columns: 42px minmax(0, 1fr) 42px; gap: 7px; margin-bottom: 17px; }
  .month-heading h2 { font-size: 18px; }
  .month-heading p { font-size: 11px; }
  .month-step { width: 40px; min-height: 40px; }
  .calendar-grid { gap: 3px; }
  .calendar-weekday { padding-bottom: 7px; font-size: 10px; }
  .calendar-day { min-height: 61px; padding: 6px 5px; border-radius: 8px; }
  .calendar-day-number { font-size: 12px; }
  .calendar-day-label { margin-top: 6px; font-size: 8px; line-height: 1.15; }
  .calendar-legend { gap: 8px 12px; padding-top: 14px; font-size: 11px; }
  .calendar-section-heading h2 { font-size: 18px; }
  .calendar-confirm-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .calendar-confirm-actions .secondary-button, .calendar-confirm-actions .close-semester-button { width: 100%; min-width: 0; padding-inline: 8px; font-size: 12px; }
  .dialog-backdrop { align-items: end; padding: 0; }
  .calendar-confirm-dialog { width: 100%; max-height: 92svh; padding: 24px 19px 20px; border-radius: 18px 18px 0 0; }
}
</style>
