import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { getAttendanceReport, type AttendanceReportMode } from '../../../database/repositories/reports.ts'
import {
  AttendanceReportLayoutError,
  buildAttendanceReportLayoutBundle,
  hasAttendanceReportStudents,
  renderAttendanceReportPdf,
} from '../../../utils/report-export.ts'
import type { AttendanceReportPaper } from '../../../../app/types/attendance-report.ts'
import { isUuid } from '../../../utils/study-api.ts'
import { readAttendanceReportLogo } from '../../../utils/report-logo.ts'

function reportInputError(message: string): never {
  throw createError({ statusCode: 422, statusMessage: message })
}

function isYearMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(value)
}

function isPaper(value: unknown): value is AttendanceReportPaper {
  return value === 'a4' || value === 'f4' || value === 'letter'
}

function safeFilename(semesterId: string, period: string): string {
  const semesterPrefix = semesterId.replace(/[^a-f\d]/gi, '').slice(0, 8).toLowerCase()
  return `laporan-absensi-${semesterPrefix}-${period}.pdf`
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = getRouterParam(event, 'semesterId') ?? ''
  if (!isUuid(semesterId)) reportInputError('Pilih semester yang benar.')

  const query = getQuery(event)
  if (query.date !== undefined) reportInputError('Laporan menggunakan pilihan bulan, bukan tanggal.')
  if (query.mode !== 'month' && query.mode !== 'semester') {
    reportInputError('Pilih laporan bulan atau semester.')
  }
  const mode: AttendanceReportMode = query.mode
  if (!isPaper(query.paper)) reportInputError('Pilih ukuran kertas laporan yang tersedia.')
  const paper = query.paper

  let month: string | undefined
  let period = 'semester'
  if (mode === 'month') {
    if (!isYearMonth(query.month)) reportInputError('Pilih bulan dengan format YYYY-MM yang benar.')
    month = query.month
    period = month
  } else if (query.month !== undefined) {
    reportInputError('Hapus pilihan bulan untuk mengunduh laporan semester.')
  }

  const requestedRevision = query.revision
  if (requestedRevision !== undefined
    && (typeof requestedRevision !== 'string' || !/^[a-f\d]{64}$/i.test(requestedRevision))) {
    reportInputError('Pratinjau laporan sudah tidak berlaku. Tampilkan ulang laporan sebelum mengunduh PDF.')
  }

  try {
    const result = await getAttendanceReport(getDatabase(), {
      teacherId: teacher.id,
      semesterId,
      mode,
      ...(month ? { month } : {}),
    })
    if (result.kind === 'not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Semester tidak ditemukan atau tidak dapat diakses.' })
    }
    if (result.kind === 'month_outside_semester') {
      reportInputError('Bulan yang dipilih berada di luar periode semester.')
    }

    const bundle = buildAttendanceReportLayoutBundle(result.report)
    if (typeof requestedRevision === 'string' && requestedRevision.toLowerCase() !== bundle.revision) {
      throw createError({ statusCode: 409, statusMessage: 'Data laporan sudah berubah. Tampilkan ulang laporan sebelum mengunduh PDF.' })
    }
    if (!hasAttendanceReportStudents(bundle.report)) {
      reportInputError('Tidak ada siswa pada periode ini.')
    }

    let pdf: Buffer
    try {
      const logoBytes = await readAttendanceReportLogo(bundle.report.semester.logo)
      pdf = await renderAttendanceReportPdf(bundle, paper, logoBytes)
    } catch (error) {
      if (error instanceof AttendanceReportLayoutError && error.code === 'row_too_tall') {
        throw createError({ statusCode: 422, statusMessage: 'Nama siswa terlalu panjang untuk ditampilkan pada ukuran kertas ini.' })
      }
      throw error
    }

    setResponseHeader(event, 'content-type', 'application/pdf')
    setResponseHeader(event, 'content-disposition', `attachment; filename="${safeFilename(semesterId, period)}"`)
    setResponseHeader(event, 'content-length', pdf.byteLength)
    return pdf
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'PDF laporan belum dapat disiapkan. Coba lagi.' })
  }
})
