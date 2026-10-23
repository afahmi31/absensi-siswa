import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { getDatabase } from '../../database/client.ts'
import { getAttendanceReport, type AttendanceReportMode } from '../../database/repositories/reports.ts'
import { isUuid } from '../../utils/study-api.ts'

function reportInputError(message: string): never {
  throw createError({ statusCode: 422, statusMessage: message })
}

function isYearMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(value)
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const semesterId = getRouterParam(event, 'semesterId') ?? ''
  if (!isUuid(semesterId)) reportInputError('Pilih semester yang benar.')

  const query = getQuery(event)
  const modeValue = query.mode
  if (modeValue !== 'month' && modeValue !== 'semester') {
    reportInputError('Pilih laporan bulan atau semester.')
  }
  if (query.date !== undefined) {
    reportInputError('Laporan menggunakan pilihan bulan, bukan tanggal.')
  }
  const mode: AttendanceReportMode = modeValue
  let month: string | undefined
  if (mode === 'month') {
    if (!isYearMonth(query.month)) reportInputError('Pilih bulan dengan format YYYY-MM yang benar.')
    month = query.month
  } else if (query.month !== undefined) {
    reportInputError('Hapus pilihan bulan untuk membuka laporan semester.')
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
    return result.report
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Laporan belum dapat dimuat. Coba lagi.' })
  }
})
