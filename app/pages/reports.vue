<script setup lang="ts">
import { getApiMessage } from '../utils/api-errors.ts'
import type {
  AttendanceReportLayoutBundle,
  AttendanceReportLayoutPage,
  AttendanceReportMode,
  AttendanceReportPaper,
  AttendanceReportPaperPlan,
  AttendanceStatus,
} from '../types/attendance-report.ts'

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

const paperSizes: Array<{ value: AttendanceReportPaper; label: string; detail: string }> = [
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
const paperSize = ref<AttendanceReportPaper>('f4')
const selectedPageSize = computed(() => ({
  a4: 'A4 landscape',
  f4: '33cm 21.6cm',
  letter: 'letter landscape',
})[paperSize.value])
useHead(() => ({
  style: [{
    key: 'reports-print-page-size',
    innerHTML: `@page { size: ${selectedPageSize.value}; margin: 0; }`,
  }],
}))
const layoutBundle = ref<AttendanceReportLayoutBundle | null>(null)
const report = computed(() => layoutBundle.value?.report ?? null)
const reportSelectionKey = ref('')
const isLoadingReport = ref(false)
const reportError = ref('')
const isDownloading = ref(false)
const downloadError = ref('')
const downloadStatus = ref('')
const reportRevisionStale = ref(false)
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
const hasCurrentReport = computed(() => Boolean(layoutBundle.value && reportSelectionKey.value === selectionKey.value))
const hasStudents = computed(() => Boolean(hasCurrentReport.value && report.value?.months.some((month) => month.rows.length > 0)))
const selectedPlan = computed(() => layoutBundle.value?.plans[paperSize.value] ?? null)
const canLoadReport = computed(() => isClientReady.value && hasLoaded.value && !isDownloading.value && Boolean(selectedSemester.value) && (mode.value === 'semester' || monthOptions.value.includes(selectedMonth.value)))
const canPrint = computed(() => isClientReady.value && hasStudents.value && !isLoadingReport.value)
const canDownload = computed(() => isClientReady.value && hasStudents.value && !isLoadingReport.value && !isDownloading.value && !reportRevisionStale.value)

interface PreviewPage {
  page: AttendanceReportLayoutPage
  month: NonNullable<AttendanceReportLayoutBundle['report']['months'][number]>
  rows: Array<{
    layout: AttendanceReportLayoutPage['rows'][number]
    row: NonNullable<AttendanceReportLayoutBundle['report']['months'][number]['rows'][number]>
  }>
}

const previewPages = computed<PreviewPage[]>(() => {
  if (!hasCurrentReport.value || !report.value || !selectedPlan.value) return []
  const pages: PreviewPage[] = []
  for (const page of selectedPlan.value.pages) {
    const month = report.value.months[page.monthIndex]
    if (!month) continue
    const rows = page.rows.flatMap((layout) => {
      const row = month.rows[layout.rowIndex]
      return row && row.membershipId === layout.membershipId ? [{ layout, row }] : []
    })
    pages.push({ page, month, rows })
  }
  return pages
})

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart(value))
}

function onSemesterChange() {
  selectedMonth.value = selectedSemester.value?.startsOn.slice(0, 7) ?? ''
}

watch(selectionKey, () => {
  requestGeneration += 1
  layoutBundle.value = null
  reportSelectionKey.value = ''
  reportError.value = ''
  downloadError.value = ''
  downloadStatus.value = ''
  reportRevisionStale.value = false
  isLoadingReport.value = false
}, { flush: 'sync' })

watch(paperSize, () => {
  downloadError.value = ''
  downloadStatus.value = ''
})

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
  downloadError.value = ''
  downloadStatus.value = ''
  reportRevisionStale.value = false
  layoutBundle.value = null
  reportSelectionKey.value = ''

  const query = new URLSearchParams({ mode: mode.value })
  if (mode.value === 'month') query.set('month', selectedMonth.value)

  try {
    const result = await $fetch<AttendanceReportLayoutBundle>(`/api/reports/${encodeURIComponent(semester.id)}/layout?${query.toString()}`)
    if (generation !== requestGeneration || currentSelection !== selectionKey.value) return
    layoutBundle.value = result
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

function columnStyle(plan: AttendanceReportPaperPlan, index: number) {
  return { width: `${plan.columnWidthsPt[index] ?? 0}pt` }
}

function sheetStyle(plan: AttendanceReportPaperPlan) {
  return {
    width: `${plan.widthPt}pt`,
    height: `${plan.heightPt}pt`,
    padding: `${plan.marginPt}pt`,
    '--report-content-width': `${plan.contentWidthPt}pt`,
  }
}

async function downloadReport() {
  if (!canDownload.value || import.meta.server) return
  const semester = selectedSemester.value
  const bundle = layoutBundle.value
  if (!semester || !bundle) return

  const currentSelection = selectionKey.value
  const currentPaper = paperSize.value
  isDownloading.value = true
  downloadError.value = ''
  downloadStatus.value = ''

  const query = new URLSearchParams({ mode: mode.value, paper: currentPaper, revision: bundle.revision })
  if (mode.value === 'month') query.set('month', selectedMonth.value)

  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(semester.id)}/pdf?${query.toString()}`, {
      headers: { accept: 'application/pdf' },
      credentials: 'same-origin',
    })
    if (!response.ok) {
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (contentType === 'application/json') {
        try {
          const body = await response.json()
          downloadError.value = getApiMessage({ data: body }, 'PDF laporan belum dapat disiapkan. Coba lagi.')
        } catch {
          downloadError.value = 'PDF laporan belum dapat disiapkan. Coba lagi.'
        }
      } else {
        downloadError.value = 'PDF laporan belum dapat disiapkan. Coba lagi.'
      }
      if (response.status === 409) reportRevisionStale.value = true
      return
    }

    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (contentType !== 'application/pdf') throw new Error('Respons bukan berkas PDF.')
    const blob = await response.blob()
    if (!blob.size || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('Isi PDF belum lengkap.')
    if (currentSelection !== selectionKey.value || currentPaper !== paperSize.value) return

    const filenamePeriod = mode.value === 'month' ? selectedMonth.value : 'semester'
    const filename = `laporan-absensi-${semester.id.replace(/[^a-f\d]/gi, '').slice(0, 8).toLowerCase()}-${filenamePeriod}.pdf`
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    downloadStatus.value = 'Unduhan PDF dimulai di browser.'
  } catch (error) {
    downloadError.value = getApiMessage(error, 'Belum berhasil menyiapkan PDF. Coba lagi.')
  } finally {
    isDownloading.value = false
  }
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
        <fieldset class="report-field report-mode-field" :disabled="isLoadingReport || isDownloading">
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
          <select id="report-semester" v-model="selectedSemesterId" :disabled="isLoadingReport || isDownloading || isInitialLoading" @change="onSemesterChange">
            <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
              {{ semesterLabel(semester) }} · {{ semester.status === 'active' ? 'Aktif' : 'Arsip' }}
            </option>
          </select>
        </div>

        <div v-if="mode === 'month'" class="report-field">
          <label for="report-month">Bulan</label>
          <select id="report-month" v-model="selectedMonth" :disabled="isLoadingReport || isDownloading || monthOptions.length === 0">
            <option v-for="month in monthOptions" :key="month" :value="month">{{ formatMonth(month) }}</option>
          </select>
        </div>

        <fieldset class="report-field report-paper-field" :disabled="isDownloading">
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
          <button class="primary-button report-show-button" type="submit" :disabled="!canLoadReport || isLoadingReport || isDownloading">
            {{ isLoadingReport ? 'Memuat laporan…' : 'Tampilkan laporan' }}
          </button>
          <button class="secondary-button report-print-button" type="button" :disabled="!canPrint || isDownloading" @click="printReport">
            {{ mode === 'semester' ? 'Cetak semester' : 'Cetak laporan' }}
          </button>
          <button class="primary-button report-download-button" type="button" :disabled="!canDownload" @click="downloadReport">
            {{ isDownloading ? 'Menyiapkan PDF…' : 'Unduh PDF' }}
          </button>
        </div>
      </form>

      <div v-if="downloadError" class="form-error report-message" role="alert">
        <span>{{ downloadError }}</span>
        <button v-if="reportRevisionStale" class="text-button" type="button" :disabled="isLoadingReport" @click="loadReport">Tampilkan ulang laporan</button>
        <button v-else class="text-button" type="button" :disabled="isDownloading" @click="downloadReport">Coba lagi</button>
      </div>
      <p v-if="downloadStatus" class="report-download-status" role="status" aria-live="polite">{{ downloadStatus }}</p>

      <p v-if="isLoadingReport" class="report-loading" role="status" aria-live="polite">Memuat laporan…</p>
      <div v-else-if="reportError" class="form-error report-message" role="alert">
        <span>{{ reportError }}</span>
        <button class="text-button" type="button" @click="loadReport">Coba lagi</button>
      </div>
      <p v-else-if="!hasCurrentReport" class="report-idle-note" role="status">Pilih periode, lalu tampilkan laporan untuk melihat pratinjau.</p>

      <template v-if="hasCurrentReport && report">
        <p v-if="!hasStudents" class="content-card report-no-students" role="status">Tidak ada siswa pada periode ini.</p>

        <section v-else-if="selectedPlan" class="report-preview" aria-label="Pratinjau laporan">
          <div class="report-preview-heading">
            <div>
              <p class="eyebrow">Pratinjau</p>
              <h2>{{ mode === 'semester' ? `Laporan semester · ${semesterLabel(report.semester)}` : `Laporan bulanan · ${formatMonth(report.months[0]?.month ?? selectedMonth)}` }} · {{ paperSizes.find((paper) => paper.value === paperSize)?.label }}</h2>
            </div>
            <p class="report-scroll-note">Geser halaman ke samping untuk melihat ukuran kertas penuh.</p>
          </div>

          <div v-for="(previewPage, pageIndex) in previewPages" :key="`${previewPage.page.month}-${previewPage.page.pageInMonth}`" class="report-sheet-viewport">
            <article class="report-sheet" :class="{ 'report-sheet-last': pageIndex === previewPages.length - 1 }" :style="sheetStyle(selectedPlan)">
              <header class="report-sheet-heading">
                <p v-for="(part, partIndex) in previewPage.page.headingParts" :key="`${part.kind}-${partIndex}`" class="report-heading-part" :class="`report-heading-${part.kind}`" :style="{ fontSize: `${part.fontSizePt}pt`, lineHeight: `${part.lineHeightPt}pt`, fontWeight: part.fontWeight, marginTop: `${part.gapBeforePt}pt`, marginBottom: `${part.gapAfterPt}pt` }">
                  <span v-for="(line, lineIndex) in part.lines" :key="lineIndex">{{ line }}</span>
                </p>
              </header>
              <table class="report-table" :style="{ width: `${selectedPlan.contentWidthPt}pt` }">
                <caption class="visually-hidden">Laporan absensi {{ formatMonth(previewPage.month.month) }} — {{ report.semester.schoolName }}, {{ report.semester.className }}</caption>
                <colgroup>
                  <col v-for="(width, columnIndex) in selectedPlan.columnWidthsPt" :key="columnIndex" :style="columnStyle(selectedPlan, columnIndex)">
                </colgroup>
                <thead>
                  <tr :style="{ height: `${previewPage.page.tableHeaderRowHeightsPt[0]}pt` }">
                    <th rowspan="2" scope="col">No.</th>
                    <th rowspan="2" scope="col">Nama siswa</th>
                    <th rowspan="2" scope="col">NIPD</th>
                    <th rowspan="2" scope="col">JK</th>
                    <th colspan="31" scope="colgroup">Tanggal</th>
                    <th colspan="3" scope="colgroup">Jumlah</th>
                  </tr>
                  <tr :style="{ height: `${previewPage.page.tableHeaderRowHeightsPt[1]}pt` }">
                    <th v-for="day in previewPage.month.days" :key="day.day" scope="col" :aria-label="day.date ? `Tanggal ${day.day} ${formatMonth(previewPage.month.month)}` : undefined">
                      {{ day.day }}
                    </th>
                    <th scope="col">S</th>
                    <th scope="col">I</th>
                    <th scope="col">A</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in previewPage.rows" :key="entry.row.membershipId" :style="{ height: `${entry.layout.heightPt}pt`, lineHeight: `${entry.layout.lineHeightPt}pt` }">
                    <td class="report-row-number">{{ entry.layout.rowIndex + 1 }}</td>
                    <th class="report-student-name" scope="row"><span v-for="(line, lineIndex) in entry.layout.nameLines" :key="lineIndex">{{ line }}</span></th>
                    <td class="report-student-number"><span v-for="(line, lineIndex) in entry.layout.studentNumberLines" :key="lineIndex">{{ line }}</span></td>
                    <td>{{ entry.row.gender ?? '' }}</td>
                    <td v-for="(cell, cellIndex) in entry.row.cells" :key="cellIndex" :aria-label="cell ? statusDescription(cell) : undefined">{{ cell ?? '' }}</td>
                    <td>{{ entry.row.totals.S }}</td>
                    <td>{{ entry.row.totals.I }}</td>
                    <td>{{ entry.row.totals.A }}</td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>
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
.report-control-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.report-control-actions button { width: auto; min-width: 132px; min-height: 46px; margin: 0; white-space: nowrap; }
.report-show-button { padding-inline: 13px; }
.report-control-actions button:disabled { opacity: .55; cursor: not-allowed; }
.report-message { display: flex; align-items: center; gap: 8px; margin: 15px 0; }
.report-message .text-button { padding-inline: 0; text-decoration: underline; }
.report-loading, .report-idle-note, .report-download-status { margin: 20px 0; color: #536b65; font-size: 14px; }
.report-empty-state, .report-no-students { max-width: 780px; margin: 19px auto; padding: 35px 24px; text-align: center; }
.report-empty-state h2 { margin: 0; font-size: 19px; }
.report-empty-state p, .report-no-students { color: #536b65; font-size: 14px; line-height: 1.5; }
.report-empty-link { display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 185px; margin-top: 20px; text-decoration: none; }
.report-preview { margin-top: 27px; }
.report-preview-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 15px; }
.report-preview-heading h2 { margin: 4px 0 0; font-size: 20px; line-height: 1.3; }
.report-scroll-note { margin: 0; color: #536b65; font-size: 12px; }
.report-sheet-viewport { max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; margin: 0 0 18px; padding: 2px 0 8px; }
.report-sheet { box-sizing: border-box; margin: 0 auto; overflow: hidden; color: #111; background: #fff; box-shadow: 0 8px 24px #193c3022; font-family: Helvetica, Arial, sans-serif; }
.report-sheet-heading { margin: 0; }
.report-heading-part { margin-left: 0; margin-right: 0; white-space: normal; }
.report-heading-part span, .report-student-name span, .report-student-number span { display: block; white-space: pre; }
.report-heading-school, .report-heading-title { color: #172d29; }
.report-heading-semester, .report-heading-note { color: #304d46; }
.report-table { box-sizing: border-box; table-layout: fixed; border-collapse: collapse; color: #111; background: #fff; font-size: 6pt; text-align: center; }
.report-table th, .report-table td { box-sizing: border-box; height: auto; padding: 0 2.4pt; border: .32pt solid #333; line-height: 7.2pt; overflow: hidden; }
.report-table thead th { padding: 0 1pt; color: #111; background: #eef2f1; font-size: 5.6pt; font-weight: 700; }
.report-table thead tr { height: auto; }
.report-table thead th[rowspan="2"] { vertical-align: middle; }
.report-row-number, .report-student-number { color: #304d46; }
.report-student-name { text-align: left; font-weight: 400; }
.report-table caption { font-size: 0; }

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
  .report-sheet-viewport { margin-bottom: 12px; }
  .report-empty-state, .report-no-students { padding: 27px 19px; }
}

@media print {
  html, body, #__nuxt { min-width: 0 !important; min-height: 0 !important; background: #fff !important; }
  body { margin: 0 !important; }
  .app-shell { min-height: 0 !important; padding: 0 !important; }
  .app-header, .report-page-heading, .report-controls, .report-loading, .report-idle-note, .report-preview-heading, .report-scroll-note, .report-empty-state, .report-no-students, .report-message, .report-download-status { display: none !important; }
  .reports-page { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .report-preview { display: block !important; margin: 0 !important; }
  .report-sheet-viewport { width: auto !important; max-width: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
  .report-sheet { margin: 0 !important; box-shadow: none !important; break-inside: avoid-page; page-break-inside: avoid; }
  .report-sheet:not(.report-sheet-last) { break-after: page; page-break-after: always; }
  .report-table { break-inside: avoid-page; page-break-inside: avoid; }
  .report-table thead { display: table-header-group !important; }
  .report-table tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  .report-heading-school, .report-heading-title, .report-heading-semester, .report-heading-note,
  .report-table th, .report-table td { color: #000 !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
