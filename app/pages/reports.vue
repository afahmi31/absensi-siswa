<script setup lang="ts">
import { getApiMessage } from '../utils/api-errors.ts'
import type { AttendanceReport, AttendanceReportMode, AttendanceStatus } from '../types/attendance-report.ts'

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

interface SchoolResponse {
  school: { id: string; name: string; className: string; timeZone: string } | null
}

type PaperSize = 'a4' | 'f4' | 'letter'

const paperSizes: Array<{ value: PaperSize; label: string; detail: string }> = [
  { value: 'a4', label: 'A4', detail: '29,7 × 21 cm · mendatar' },
  { value: 'f4', label: 'F4/Folio', detail: '33 × 21,6 cm · mendatar' },
  { value: 'letter', label: 'Letter', detail: '27,94 × 21,59 cm · mendatar' },
]

const requestFetch = useRequestFetch()
const [initialSemesters, initialSchool] = await Promise.all([
  requestFetch<SemesterListResponse>('/api/semesters').catch(() => null),
  requestFetch<SchoolResponse>('/api/school').catch(() => null),
])

function preferredSemester(records: SemesterRecord[]): SemesterRecord | null {
  const active = records.find((semester) => semester.status === 'active')
  if (active) return active
  return [...records].sort((left, right) => right.startsOn.localeCompare(left.startsOn))[0] ?? null
}

const semesters = ref(initialSemesters?.semesters ?? [])
const school = ref(initialSchool?.school ?? null)
const hasLoaded = ref(initialSemesters !== null && initialSchool !== null)
const isInitialLoading = ref(false)
const isClientReady = ref(false)
const initialError = ref(hasLoaded.value ? '' : 'Data sekolah dan semester belum dapat dimuat. Coba lagi.')
const selectedSemesterId = ref(preferredSemester(semesters.value)?.id ?? '')
const selectedMonth = ref(preferredSemester(semesters.value)?.startsOn.slice(0, 7) ?? '')
const mode = ref<AttendanceReportMode>('month')
const paperSize = ref<PaperSize>('f4')
const selectedPageSize = computed(() => ({
  a4: 'A4 landscape',
  f4: '33cm 21.6cm',
  letter: 'letter landscape',
})[paperSize.value])
useHead(() => ({
  style: [{
    key: 'reports-print-page-size',
    innerHTML: `@page { size: ${selectedPageSize.value}; margin: 6mm; }`,
  }],
}))
const report = ref<AttendanceReport | null>(null)
const reportSelectionKey = ref('')
const isLoadingReport = ref(false)
const reportError = ref('')
let requestGeneration = 0

onMounted(() => {
  isClientReady.value = true
})

const selectedSemester = computed(() => semesters.value.find((semester) => semester.id === selectedSemesterId.value) ?? null)

function semesterLabel(semester: Pick<SemesterRecord, 'academicYear' | 'term'>): string {
  return `${semester.term === 'ganjil' ? 'Ganjil' : 'Genap'} ${semester.academicYear}`
}

function monthStart(value: string): Date {
  const [year = 1, month = 1] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function listMonths(semester: SemesterRecord | null): string[] {
  if (!semester) return []
  const first = monthStart(semester.startsOn.slice(0, 7))
  const last = monthStart(semester.endsOn.slice(0, 7))
  const months: string[] = []
  for (const current = new Date(first); current <= last; current.setUTCMonth(current.getUTCMonth() + 1)) {
    months.push(monthKey(current))
  }
  return months
}

const monthOptions = computed(() => listMonths(selectedSemester.value))
const selectionKey = computed(() => [
  selectedSemesterId.value,
  mode.value,
  mode.value === 'month' ? selectedMonth.value : '',
].join('|'))
const hasCurrentReport = computed(() => Boolean(report.value && reportSelectionKey.value === selectionKey.value))
const hasStudents = computed(() => Boolean(hasCurrentReport.value && report.value?.months.some((month) => month.rows.length > 0)))
const canLoadReport = computed(() => isClientReady.value && hasLoaded.value && Boolean(selectedSemester.value) && (mode.value === 'semester' || monthOptions.value.includes(selectedMonth.value)))
const canPrint = computed(() => isClientReady.value && hasStudents.value && !isLoadingReport.value)

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart(value))
}

function onSemesterChange() {
  selectedMonth.value = selectedSemester.value?.startsOn.slice(0, 7) ?? ''
}

watch(selectionKey, () => {
  requestGeneration += 1
  report.value = null
  reportSelectionKey.value = ''
  reportError.value = ''
  isLoadingReport.value = false
}, { flush: 'sync' })

async function reloadInitialData() {
  if (isInitialLoading.value) return
  isInitialLoading.value = true
  initialError.value = ''
  try {
    const [semesterResult, schoolResult] = await Promise.all([
      $fetch<SemesterListResponse>('/api/semesters'),
      $fetch<SchoolResponse>('/api/school'),
    ])
    const previousSemesterId = selectedSemesterId.value
    semesters.value = semesterResult.semesters
    school.value = schoolResult.school
    selectedSemesterId.value = semesterResult.semesters.some((semester) => semester.id === previousSemesterId)
      ? previousSemesterId
      : preferredSemester(semesterResult.semesters)?.id ?? ''
    if (!selectedSemesterId.value || selectedSemesterId.value !== previousSemesterId) onSemesterChange()
    hasLoaded.value = true
  } catch {
    initialError.value = 'Data sekolah dan semester belum dapat dimuat. Coba lagi.'
  } finally {
    isInitialLoading.value = false
  }
}

async function loadReport() {
  if (!canLoadReport.value || isLoadingReport.value) return
  const semester = selectedSemester.value
  if (!semester) return

  const currentSelection = selectionKey.value
  const generation = ++requestGeneration
  isLoadingReport.value = true
  reportError.value = ''
  report.value = null
  reportSelectionKey.value = ''

  const query = new URLSearchParams({ mode: mode.value })
  if (mode.value === 'month') query.set('month', selectedMonth.value)

  try {
    const result = await $fetch<AttendanceReport>(`/api/reports/${encodeURIComponent(semester.id)}?${query.toString()}`)
    if (generation !== requestGeneration || currentSelection !== selectionKey.value) return
    report.value = result
    reportSelectionKey.value = currentSelection
  } catch (error) {
    if (generation === requestGeneration && currentSelection === selectionKey.value) {
      reportError.value = getApiMessage(error, 'Laporan belum dapat dimuat. Coba lagi.')
    }
  } finally {
    if (generation === requestGeneration) isLoadingReport.value = false
  }
}

function printReport() {
  if (!canPrint.value || import.meta.server) return
  window.print()
}

function statusDescription(status: AttendanceStatus): string {
  return ({ H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' })[status]
}
</script>

<template>
  <main class="page-content reports-page">
    <section class="page-heading report-page-heading">
      <p class="eyebrow">Rekap kehadiran</p>
      <h1>Laporan absensi</h1>
      <p>Pilih periode dan ukuran kertas sebelum melihat pratinjau atau mencetak.</p>
    </section>

    <p v-if="initialError" class="form-error report-message" role="alert">
      {{ initialError }}
      <button class="text-button" type="button" :disabled="isInitialLoading" @click="reloadInitialData">
        {{ isInitialLoading ? 'Memuat…' : 'Coba lagi' }}
      </button>
    </p>

    <section v-if="!hasLoaded && !initialError" class="content-card report-empty-state" role="status">
      <p>Memuat data sekolah dan semester…</p>
    </section>

    <section v-else-if="hasLoaded && !school" class="content-card report-empty-state" aria-labelledby="report-school-title">
      <span class="empty-state-icon" aria-hidden="true">⌂</span>
      <h2 id="report-school-title">Data sekolah belum tersedia</h2>
      <p>Siapkan nama sekolah dan kelas sebelum melihat laporan absensi.</p>
      <NuxtLink class="primary-button report-empty-link" to="/school">Atur data sekolah</NuxtLink>
    </section>

    <section v-else-if="hasLoaded && semesters.length === 0" class="content-card report-empty-state" aria-labelledby="report-semester-title">
      <span class="empty-state-icon" aria-hidden="true">▤</span>
      <h2 id="report-semester-title">Belum ada semester</h2>
      <p>Buat semester terlebih dahulu untuk memilih periode laporan.</p>
      <NuxtLink class="primary-button report-empty-link" to="/semesters">Kelola semester</NuxtLink>
    </section>

    <template v-else-if="hasLoaded && selectedSemester">
      <form class="content-card report-controls" @submit.prevent="loadReport">
        <fieldset class="report-field report-mode-field">
          <legend>Jenis laporan</legend>
          <div class="report-choice-row report-mode-options">
            <label class="report-choice" :class="{ 'report-choice-selected': mode === 'month' }">
              <input v-model="mode" type="radio" name="report-mode" value="month">
              <span>Bulanan</span>
            </label>
            <label class="report-choice" :class="{ 'report-choice-selected': mode === 'semester' }">
              <input v-model="mode" type="radio" name="report-mode" value="semester">
              <span>Semester</span>
            </label>
          </div>
        </fieldset>

        <div class="report-field">
          <label for="report-semester">Semester</label>
          <select id="report-semester" v-model="selectedSemesterId" :disabled="isLoadingReport || isInitialLoading" @change="onSemesterChange">
            <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
              {{ semesterLabel(semester) }} · {{ semester.status === 'active' ? 'Aktif' : 'Arsip' }}
            </option>
          </select>
        </div>

        <div v-if="mode === 'month'" class="report-field">
          <label for="report-month">Bulan</label>
          <select id="report-month" v-model="selectedMonth" :disabled="isLoadingReport || monthOptions.length === 0">
            <option v-for="month in monthOptions" :key="month" :value="month">{{ formatMonth(month) }}</option>
          </select>
        </div>

        <fieldset class="report-field report-paper-field">
          <legend>Ukuran kertas · mendatar</legend>
          <div class="report-choice-row report-paper-options">
            <label v-for="paper in paperSizes" :key="paper.value" class="report-choice report-paper-choice" :class="{ 'report-choice-selected': paperSize === paper.value }">
              <input v-model="paperSize" type="radio" name="report-paper" :value="paper.value">
              <span>{{ paper.label }}</span>
              <small>{{ paper.detail }}</small>
            </label>
          </div>
        </fieldset>

        <div class="report-control-actions">
          <button class="primary-button report-show-button" type="submit" :disabled="!canLoadReport || isLoadingReport">
            {{ isLoadingReport ? 'Memuat laporan…' : 'Tampilkan laporan' }}
          </button>
          <button class="secondary-button report-print-button" type="button" :disabled="!canPrint" @click="printReport">
            {{ mode === 'semester' ? 'Cetak semester' : 'Cetak laporan' }}
          </button>
        </div>
      </form>

      <p v-if="isLoadingReport" class="report-loading" role="status" aria-live="polite">Memuat laporan…</p>
      <div v-else-if="reportError" class="form-error report-message" role="alert">
        <span>{{ reportError }}</span>
        <button class="text-button" type="button" @click="loadReport">Coba lagi</button>
      </div>
      <p v-else-if="!hasCurrentReport" class="report-idle-note" role="status">Pilih periode, lalu tampilkan laporan untuk melihat pratinjau.</p>

      <template v-if="hasCurrentReport && report">
        <p v-if="!hasStudents" class="content-card report-no-students" role="status">Tidak ada siswa pada periode ini.</p>

        <section v-else class="report-preview" aria-label="Pratinjau laporan">
          <div class="report-preview-heading">
            <div>
              <p class="eyebrow">Pratinjau</p>
              <h2>{{ mode === 'semester' ? `Laporan semester · ${semesterLabel(report.semester)}` : `Laporan bulanan · ${formatMonth(report.months[0]?.month ?? selectedMonth)}` }}</h2>
            </div>
            <p class="report-scroll-note">Geser tabel ke samping untuk melihat seluruh tanggal dan jumlah.</p>
          </div>

          <article
            v-for="(month, monthIndex) in report.months"
            :key="month.month"
            class="report-sheet"
          >
            <header class="report-sheet-heading">
              <div>
                <p class="eyebrow">{{ report.semester.schoolName }}<span v-if="report.semester.className"> · {{ report.semester.className }}</span></p>
                <h3>{{ formatMonth(month.month) }}</h3>
              </div>
              <p>{{ semesterLabel(report.semester) }} · {{ report.semester.status === 'closed' ? 'Arsip' : 'Aktif' }}</p>
            </header>
            <p class="report-table-note">Hari libur, di luar masa terdaftar atau periode, serta tanggal tanpa catatan tetap kosong.</p>
            <div class="report-table-wrap" tabindex="0" :aria-label="`Tabel laporan ${formatMonth(month.month)}. Geser mendatar untuk melihat seluruh kolom.`">
              <table class="report-table">
                <caption class="visually-hidden">Laporan absensi {{ formatMonth(month.month) }} — {{ report.semester.schoolName }}, {{ report.semester.className }}</caption>
                <colgroup>
                  <col class="report-col-number">
                  <col class="report-col-name">
                  <col class="report-col-student-number">
                  <col class="report-col-gender">
                  <col v-for="day in month.days" :key="day.day" class="report-col-day">
                  <col v-for="status in ['S', 'I', 'A']" :key="status" class="report-col-total">
                </colgroup>
                <thead>
                  <tr>
                    <th rowspan="2" scope="col">No.</th>
                    <th rowspan="2" scope="col">Nama siswa</th>
                    <th rowspan="2" scope="col">NIPD</th>
                    <th rowspan="2" scope="col">JK</th>
                    <th colspan="31" scope="colgroup">Tanggal</th>
                    <th colspan="3" scope="colgroup">Jumlah</th>
                  </tr>
                  <tr>
                    <th v-for="day in month.days" :key="day.day" scope="col" :aria-label="day.date ? `Tanggal ${day.day} ${formatMonth(month.month)}` : undefined">
                      {{ day.day }}
                    </th>
                    <th scope="col">S</th>
                    <th scope="col">I</th>
                    <th scope="col">A</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in month.rows" :key="row.membershipId">
                    <td class="report-row-number">{{ rowIndex + 1 }}</td>
                    <th class="report-student-name" scope="row">{{ row.name }}</th>
                    <td class="report-student-number">{{ row.studentNumber ?? '' }}</td>
                    <td>{{ row.gender ?? '' }}</td>
                    <td v-for="(cell, cellIndex) in row.cells" :key="cellIndex" :aria-label="cell ? statusDescription(cell) : undefined">{{ cell ?? '' }}</td>
                    <td>{{ row.totals.S }}</td>
                    <td>{{ row.totals.I }}</td>
                    <td>{{ row.totals.A }}</td>
                  </tr>
                  <tr v-if="month.rows.length === 0" class="report-empty-month-row">
                    <td colspan="38">Tidak ada siswa pada periode ini.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </template>
    </template>
  </main>
</template>

<style>
.reports-page { max-width: 1440px; container-name: report-content; container-type: inline-size; }
.report-page-heading { margin-bottom: 24px; }
.report-controls { display: grid; grid-template-columns: minmax(180px, .82fr) minmax(190px, 1fr) minmax(170px, .85fr) minmax(360px, 1.45fr) auto; align-items: end; gap: 20px; padding: 22px 24px; }
.report-field { display: grid; min-width: 0; gap: 9px; margin: 0; padding: 0; border: 0; }
.report-field > label, .report-field > legend { padding: 0; color: #304d46; font-size: 13px; font-weight: 700; }
.report-field select { width: 100%; min-height: 46px; padding: 0 13px; color: #172d29; background: #fff; border: 1px solid #cddbd7; border-radius: 10px; font-size: 14px; }
.report-field select:focus-visible, .report-table-wrap:focus-visible { outline: 3px solid #61a695; outline-offset: 2px; }
.report-choice-row { display: flex; gap: 7px; min-width: 0; }
.report-choice { position: relative; display: grid; place-items: center; min-width: 0; min-height: 39px; padding: 8px 12px; color: #536b65; background: #eef3f1; border: 1px solid transparent; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; text-align: center; }
.report-choice input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.report-choice:focus-within { outline: 3px solid #61a695; outline-offset: 2px; }
.report-choice-selected { color: #126451; background: #e6f2ed; border-color: #c6ded5; }
.report-mode-options .report-choice { flex: 1; }
.report-paper-options { flex-wrap: wrap; }
.report-paper-choice { min-width: 74px; }
.report-paper-choice small { display: block; margin-top: 3px; font-size: 10px; font-weight: 400; line-height: 1.25; }
.report-control-actions { display: flex; gap: 8px; }
.report-control-actions button { width: auto; min-width: 132px; min-height: 46px; margin: 0; white-space: nowrap; }
.report-show-button { padding-inline: 13px; }
.report-print-button:disabled { opacity: .55; cursor: not-allowed; }
.report-message { display: flex; align-items: center; gap: 8px; margin: 15px 0; }
.report-message .text-button { padding-inline: 0; text-decoration: underline; }
.report-loading, .report-idle-note { margin: 20px 0; color: #536b65; font-size: 14px; }
.report-empty-state, .report-no-students { max-width: 780px; margin: 19px auto; padding: 35px 24px; text-align: center; }
.report-empty-state h2 { margin: 0; font-size: 19px; }
.report-empty-state p, .report-no-students { color: #536b65; font-size: 14px; line-height: 1.5; }
.report-empty-link { display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 185px; margin-top: 20px; text-decoration: none; }
.report-preview { margin-top: 27px; }
.report-preview-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 15px; }
.report-preview-heading h2 { margin: 4px 0 0; font-size: 20px; line-height: 1.3; }
.report-scroll-note { margin: 0; color: #536b65; font-size: 12px; }
.report-sheet { margin: 0 0 22px; padding: 21px 20px 18px; background: #fff; border: 1px solid #d8e4e0; border-radius: 15px; }
.report-sheet-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 8px; }
.report-sheet-heading .eyebrow { margin: 0; }
.report-sheet-heading h3 { margin: 4px 0 0; font-size: 19px; line-height: 1.25; }
.report-sheet-heading > p { margin: 0; color: #536b65; font-size: 12px; text-align: right; }
.report-table-note { margin: 0 0 12px; color: #536b65; font-size: 12px; line-height: 1.4; }
.report-table-wrap { max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; border: 1px solid #9daaa5; }
.report-table { width: 100%; min-width: 1870px; table-layout: fixed; border-collapse: collapse; color: #172d29; background: #fff; font-size: 11px; text-align: center; }
.report-table th, .report-table td { height: 31px; padding: 5px 4px; border: 1px solid #aebbb6; line-height: 1.25; }
.report-table thead th { color: #304d46; background: #f2f5f4; font-size: 10px; font-weight: 700; }
.report-table thead tr:first-child th { height: 34px; }
.report-col-number { width: 44px; }
.report-col-name { width: 225px; }
.report-col-student-number { width: 120px; }
.report-col-gender { width: 52px; }
.report-col-day { width: 42px; }
.report-col-total { width: 48px; }
.report-row-number, .report-student-number { color: #536b65; }
.report-student-name { min-width: 0; text-align: left; overflow-wrap: anywhere; white-space: normal; }
.report-empty-month-row td { height: 50px; color: #536b65; text-align: left; }

@media (max-width: 1180px) {
  .report-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .report-paper-field { grid-column: 1 / -1; }
  .report-control-actions { grid-column: 1 / -1; justify-content: flex-end; }
}

@container report-content (max-width: 1220px) {
  .report-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .report-paper-field { grid-column: 1 / -1; }
  .report-control-actions { grid-column: 1 / -1; justify-content: flex-end; }
}

@media (max-width: 760px) {
  .report-controls { grid-template-columns: 1fr; gap: 17px; padding: 18px 16px; }
  .report-paper-field, .report-control-actions { grid-column: auto; }
  .report-paper-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .report-paper-choice { min-height: 60px; padding: 7px 4px; border-radius: 10px; }
  .report-paper-choice small { font-size: 9px; }
  .report-control-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .report-control-actions button { width: 100%; min-width: 0; padding-inline: 8px; font-size: 13px; }
  .report-preview-heading { align-items: flex-start; flex-direction: column; }
  .report-preview-heading h2 { font-size: 18px; }
  .report-sheet { padding: 16px 13px 13px; border-radius: 13px; }
  .report-sheet-heading { align-items: flex-start; flex-direction: column; gap: 5px; }
  .report-sheet-heading > p { text-align: left; }
  .report-table-note { font-size: 11px; }
  .report-empty-state, .report-no-students { padding: 27px 19px; }
}

@media print {
  html, body, #__nuxt { min-width: 0 !important; min-height: 0 !important; background: #fff !important; }
  body { margin: 0 !important; }
  .app-shell { min-height: 0 !important; padding: 0 !important; }
  .app-header, .report-page-heading, .report-controls, .report-loading, .report-idle-note, .report-preview-heading, .report-scroll-note, .report-empty-state, .report-no-students, .report-message { display: none !important; }
  .reports-page { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .report-preview { display: block !important; margin: 0 !important; }
  .report-sheet { width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; color: #000 !important; background: #fff !important; border: 0 !important; border-radius: 0 !important; break-inside: auto; page-break-inside: auto; }
  .report-sheet + .report-sheet { break-before: page; page-break-before: always; }
  .report-sheet-heading { display: flex !important; align-items: end !important; justify-content: space-between !important; margin: 0 0 2mm !important; color: #000 !important; break-after: avoid-page; page-break-after: avoid; }
  .report-sheet-heading .eyebrow, .report-sheet-heading > p, .report-sheet-heading h3, .report-table-note { color: #000 !important; }
  .report-sheet-heading h3 { margin-top: 1mm !important; font-size: 11pt !important; }
  .report-sheet-heading .eyebrow, .report-sheet-heading > p { font-size: 7pt !important; }
  .report-table-note { margin: 0 0 2mm !important; font-size: 6.5pt !important; }
  .report-table-wrap { width: 100% !important; max-width: none !important; overflow: visible !important; border: 0 !important; }
  .report-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; color: #000 !important; font-size: 6pt !important; }
  .report-table th, .report-table td { height: auto !important; padding: 1.15mm 0.35mm !important; color: #000 !important; background: #fff !important; border: 0.2mm solid #333 !important; line-height: 1.15 !important; }
  .report-table thead { display: table-header-group !important; }
  .report-table thead th { color: #000 !important; background: #eee !important; font-size: 5.6pt !important; font-weight: 700 !important; }
  .report-table thead tr:first-child th { height: 6mm !important; }
  .report-col-number { width: 6mm !important; }
  .report-col-name { width: 45mm !important; }
  .report-col-student-number { width: 18mm !important; }
  .report-col-gender { width: 7mm !important; }
  .report-col-day { width: 5mm !important; }
  .report-col-total { width: 6mm !important; }
  .report-student-name { text-align: left !important; overflow-wrap: anywhere !important; white-space: normal !important; }
  .report-table tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  .report-empty-month-row { display: none !important; }
  .report-table caption { color: #000 !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
