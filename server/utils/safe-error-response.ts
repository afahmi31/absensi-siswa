type UnknownRecord = Record<string, unknown>
export type SafeErrorRequest = { method: string; pathname: string }

const ROSTER_IMPORT_COPY_RULES: Readonly<Record<string, Readonly<Record<number, ReadonlySet<string>>>>> = {
  'POST /api/students/import/preview': {
    401: new Set([
      'Silakan masuk untuk melanjutkan.',
      'Sesi sudah berakhir. Silakan masuk lagi.',
    ]),
    400: new Set([
      'Berkas belum dapat dibaca. Pilih berkas .xlsx sesuai template.',
      'Unggahan terhenti. Pilih berkas lagi.',
    ]),
    408: new Set(['Unggahan terlalu lama. Coba pilih berkas lagi.']),
    413: new Set([
      'Berkas maksimal 4 MiB.',
      'Berkas maksimal 4 MiB. Kurangi ukuran lalu pilih kembali.',
    ]),
    415: new Set(['Pilih berkas .xlsx sesuai template.']),
    422: new Set([
      'Semester unggahan tidak valid.',
      'Unggah satu berkas dan satu pilihan semester.',
      'Pilih berkas dan semester terlebih dahulu.',
      'Berkas tidak sesuai template atau melewati batas aman. Gunakan satu lembar tanpa rumus atau objek, maksimal 500 baris.',
      'Berkas harus berisi 1 sampai 500 baris siswa.',
    ]),
    404: new Set(['Semester tidak ditemukan atau tidak dapat diakses.']),
    409: new Set([
      'Data kelas belum siap. Periksa data sekolah.',
      'Semester ini sudah menjadi arsip dan hanya dapat dilihat.',
    ]),
    429: new Set(['Pemeriksaan berkas sedang penuh. Coba lagi sebentar.']),
    503: new Set(['Perubahan belum tersimpan. Coba lagi.']),
  },
  'POST /api/students/import/commit': {
    400: new Set(['Pilihan impor tidak dapat dibaca.']),
    401: new Set([
      'Silakan masuk untuk melanjutkan.',
      'Sesi sudah berakhir. Silakan masuk lagi.',
    ]),
    404: new Set([
      'Semester tidak ditemukan atau tidak dapat diakses.',
      'Pratinjau tidak ditemukan. Periksa berkas lagi.',
    ]),
    409: new Set([
      'Data kelas belum siap. Periksa data sekolah.',
      'Semester ini sudah menjadi arsip dan hanya dapat dilihat.',
      'Daftar siswa atau semester berubah. Periksa berkas lagi sebelum mengimpor.',
    ]),
    410: new Set(['Pratinjau kedaluwarsa. Periksa berkas lagi sebelum mengimpor.']),
    413: new Set(['Pilihan impor terlalu besar.']),
    422: new Set([
      'Pilihan impor tidak valid.',
      'Tentukan pilihan untuk setiap baris.',
      'Pilihan baris tidak valid.',
      'Ada baris terpilih yang perlu diperbaiki. Lewati baris tersebut atau perbaiki berkas.',
      'Pilih tambah sebagai siswa berbeda atau lewati untuk setiap nama sama.',
      'Pilih setidaknya satu siswa untuk diimpor.',
    ]),
    503: new Set(['Perubahan belum tersimpan. Coba lagi.']),
  },
}

const SAFE_STATUS_COPIES = new Set([
  'Data formulir tidak dapat dibaca. Coba kirim kembali.',
  'Data yang dikirim belum dapat dibaca. Periksa kembali lalu coba lagi.',
  'Identitas pemilik tidak dapat diubah dari formulir.',
  'Ada kolom formulir yang tidak dikenali.',
  'Periksa kembali data yang dimasukkan.',
  'Semester arsip terkunci atau tanggal tidak dapat mengecualikan catatan absensi yang sudah ada.',
  'Data bertentangan dengan catatan yang sudah ada. Periksa semester dan siswa.',
  'Sebagian data tidak sesuai dengan periode atau pengaturan sekolah.',
  'Data sekolah, semester, atau siswa tidak ditemukan.',
  'Perubahan belum tersimpan. Coba lagi.',
  'Format data formulir tidak didukung.',
  'Ukuran logo atau formulir terlalu besar. Maksimal logo 2 MB.',
  'Data formulir logo tidak valid. Periksa kembali berkas lalu coba lagi.',
  'Pilih logo PNG atau JPEG yang valid, maksimal 2 MB dan 4096 × 4096 piksel.',
  'Pilihan impor terlalu besar.',
  'Pilihan impor tidak dapat dibaca.',
  'Pilihan impor tidak valid.',
  'Layanan belum tersedia.',
  'Silakan masuk untuk melanjutkan.',
  'Sesi sudah berakhir. Silakan masuk lagi.',
  'Permintaan tidak dapat diproses.',
  'Pilih semester yang benar.',
  'Pilih tanggal yang benar.',
  'Pilih setidaknya satu status sebelum menyimpan.',
  'Pilih setidaknya satu siswa dan status untuk disimpan.',
  'Ada pilihan siswa yang tidak valid.',
  'Ada kolom absensi yang tidak dikenali.',
  'Ada siswa yang tidak valid.',
  'Siswa hanya boleh dicantumkan satu kali.',
  'Pilih hadir, sakit, izin, alpa, atau kosongkan status.',
  'Data absensi sudah berubah. Muat ulang sebelum menyimpan.',
  'Absensi berubah saat disimpan. Periksa kembali data terbaru sebelum mencoba lagi.',
  'Ada siswa yang tidak memenuhi syarat untuk tanggal ini.',
  'Tanggal absensi harus berada di dalam periode semester.',
  'Data daftar siswa, kalender, atau absensi berubah. Muat ulang setelah memutuskan untuk membuang perubahan yang belum disimpan.',
  'Tanggal ini hanya dapat dilihat dan tidak menerima perubahan absensi.',
  'Layanan absensi belum siap. Periksa konfigurasi sesi terlebih dahulu.',
  'Absensi belum dapat dimuat setelah disimpan.',
  'Pilih bulan kalender yang benar.',
  'Kalender belum dapat dimuat. Coba lagi.',
  'Periksa kembali pilihan kalender.',
  'Tanggal kalender tidak ditemukan.',
  'Periksa kembali perubahan tanggal.',
  'Data sekolah belum tersedia. Periksa pengaturan sekolah terlebih dahulu.',
  'Tanggal harus berada di dalam periode semester.',
  'Semester ini sudah menjadi arsip. Kalender hanya dapat dilihat.',
  'Tanggal ini memiliki catatan absensi. Periksa jumlah terbaru sebelum mengubah jenis hari.',
  'Jumlah absensi berubah. Periksa ringkasan terbaru sebelum mengonfirmasi kembali.',
  'Pilih semester ganjil atau genap.',
  'Tulis tahun ajaran dengan format YYYY/YYYY.',
  'Tahun kedua harus satu tahun setelah tahun pertama.',
  'Tanggal selesai harus sama dengan atau setelah tanggal mulai.',
  'Pilih laporan bulan atau semester.',
  'Laporan menggunakan pilihan bulan, bukan tanggal.',
  'Pilih bulan dengan format YYYY-MM yang benar.',
  'Hapus pilihan bulan untuk membuka laporan semester.',
  'Bulan yang dipilih berada di luar periode semester.',
  'Pilih ukuran kertas pada halaman laporan.',
  'Laporan belum dapat dimuat. Coba lagi.',
  'Data laporan sudah berubah. Tampilkan ulang laporan sebelum mengunduh PDF.',
  'Nama siswa terlalu panjang untuk ditampilkan pada ukuran kertas ini.',
  'PDF laporan belum dapat disiapkan. Coba lagi.',
  'Data sekolah belum dapat dimuat. Coba lagi.',
  'Pilih zona waktu sekolah yang valid.',
  'Pilihan logo tidak valid. Muat ulang halaman lalu coba lagi.',
  'Periksa kembali pilihan dan berkas logo.',
  'Logo belum tersedia di lingkungan ini. Data sekolah tetap dapat disimpan.',
  'Logo sekolah belum dapat dimuat. Coba lagi.',
  'Logo belum tersedia di lingkungan ini. Data sekolah tetap dapat digunakan.',
  'Logo sekolah tidak ditemukan.',
  'Semester tidak ditemukan atau tidak dapat diakses.',
  'Semester ini sudah menjadi arsip dan tidak dapat diubah.',
  'Semester untuk tahun ajaran dan jenis ini sudah tersedia.',
  'Periode bertumpang tindih dengan semester lain. Ubah tanggalnya lalu coba lagi.',
  'Periode baru tidak mencakup masa terdaftar siswa. Perbaiki tanggal siswa terlebih dahulu.',
  'Periode baru tidak mencakup catatan absensi atau riwayat yang sudah ada.',
  'Daftar semester belum dapat dimuat. Coba lagi.',
  'Pilih salin daftar semester sebelumnya atau mulai dengan daftar kosong.',
  'Simpan data sekolah dan kelas sebelum membuat semester.',
  'Data kelas belum siap. Perbarui data sekolah terlebih dahulu.',
  'Tutup semester aktif sebelum membuat semester baru.',
  'Semester arsip sebelumnya tidak ditemukan. Pilih daftar kosong atau ubah tanggal mulai.',
  'Konfirmasi diperlukan untuk menutup semester.',
  'Periksa kembali kelengkapan semester sebelum menutupnya.',
  'Semester ini sudah ditutup.',
  'Data berubah sejak pemeriksaan terakhir. Periksa kembali jumlah absensi sebelum menutup semester.',
  'Kelengkapan semester belum dapat diperiksa. Coba lagi.',
  'Data siswa tidak ditemukan.',
  'Data siswa tidak ditemukan atau tidak dapat diakses.',
  'Semester ini sudah menjadi arsip dan hanya dapat dilihat.',
  'Tanggal masuk harus berada di dalam periode semester.',
  'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.',
  'Identitas siswa tidak dapat diubah dari sekolah ini karena masih digunakan pada data aktif lain.',
  'Daftar siswa belum dapat dimuat. Coba lagi.',
  'Periksa kembali semester lalu coba lagi.',
  'Data kelas belum siap. Perbarui data sekolah terlebih dahulu.',
  'Semester arsip sebelumnya tidak ditemukan. Pilih daftar kosong atau ubah tanggal mulai.',
  'Semester sudah berubah. Muat ulang daftar semester lalu coba lagi.',
  'Data absensi sudah berubah. Muat ulang sebelum menyimpan.',
])

const SAFE_FIELD_ERRORS: Readonly<Record<string, ReadonlySet<string>>> = {
  name: new Set(['Nama sekolah wajib diisi.', 'Nama sekolah maksimal 120 karakter.']),
  className: new Set(['Nama kelas wajib diisi.', 'Nama kelas maksimal 80 karakter.']),
  fullName: new Set(['Nama siswa wajib diisi.', 'Nama siswa maksimal 200 karakter.']),
  studentNumber: new Set(['NIPD tidak valid.', 'NIPD maksimal 80 karakter.']),
  gender: new Set(['Pilih laki-laki, perempuan, atau kosongkan.']),
  startsOn: new Set([
    'Tanggal masuk harus berupa tanggal yang benar.',
    'Tanggal masuk harus berada di dalam periode semester.',
    'Pilih tanggal di dalam periode semester.',
    'Tanggal mulai harus berupa tanggal yang benar.',
  ]),
  endsOn: new Set([
    'Tanggal keluar harus berupa tanggal yang benar.',
    'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.',
    'Pilih tanggal setelah tanggal masuk dan dalam periode semester.',
    'Tanggal selesai harus berupa tanggal yang benar.',
    'Tanggal selesai harus sama dengan atau setelah tanggal mulai.',
  ]),
  semesterId: new Set(['Semester tidak valid.']),
  note: new Set(['Catatan tidak valid.', 'Catatan maksimal 240 karakter.']),
  academicYear: new Set([
    'Tulis tahun ajaran dengan format YYYY/YYYY.',
    'Tahun kedua harus satu tahun setelah tahun pertama.',
  ]),
  term: new Set(['Pilih semester ganjil atau genap.']),
  effectiveFrom: new Set(['Pilih tanggal yang benar.']),
  schoolDays: new Set(['Pilih satu atau lebih hari dengan benar, atau kosongkan untuk meliburkan semua hari.']),
  kind: new Set(['Pilih hari libur atau hari sekolah khusus.']),
  previewToken: new Set([
    'Konfirmasi kalender sudah tidak berlaku. Periksa kembali jumlah absensi.',
    'Periksa kembali jumlah absensi sebelum menutup semester.',
  ]),
  timeZone: new Set(['Pilih zona waktu sekolah yang valid.']),
  logo: new Set([
    'Format atau ukuran logo tidak sesuai.',
    'Pilihan logo tidak valid.',
    'Pilih satu berkas untuk mengganti logo, atau hapus pilihan berkas.',
  ]),
  rosterSource: new Set(['Pilih cara menyiapkan daftar siswa.']),
}

type FieldErrorRule = {
  method: string
  pathname: RegExp | string
  fields: ReadonlySet<string>
  statusMessages: ReadonlySet<string>
}

const FIELD_ERROR_RULES: readonly FieldErrorRule[] = [
  {
    method: 'GET',
    pathname: '/api/students',
    fields: new Set(['semesterId']),
    statusMessages: new Set(['Periksa kembali data yang dimasukkan.']),
  },
  {
    method: 'POST',
    pathname: '/api/students',
    fields: new Set(['semesterId', 'fullName', 'studentNumber', 'gender', 'startsOn', 'endsOn']),
    statusMessages: new Set([
      'Periksa kembali data yang dimasukkan.',
      'Tanggal masuk harus berada di dalam periode semester.',
      'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.',
    ]),
  },
  {
    method: 'PATCH',
    pathname: /^\/api\/students\/[0-9a-f-]+$/i,
    fields: new Set(['fullName', 'studentNumber', 'gender', 'startsOn', 'endsOn']),
    statusMessages: new Set([
      'Periksa kembali data yang dimasukkan.',
      'Tanggal masuk harus berada di dalam periode semester.',
      'Tanggal keluar harus berada setelah tanggal masuk dan di dalam periode semester.',
    ]),
  },
  {
    method: 'PUT',
    pathname: '/api/calendar/routine',
    fields: new Set(['effectiveFrom', 'schoolDays']),
    statusMessages: new Set(['Periksa kembali pilihan kalender.']),
  },
  {
    method: 'PUT',
    pathname: /^\/api\/calendar\/exceptions\/\d{4}-\d{2}-\d{2}$/,
    fields: new Set(['kind', 'previewToken', 'note']),
    statusMessages: new Set(['Periksa kembali perubahan tanggal.', 'Periksa kembali data yang dimasukkan.']),
  },
  {
    method: 'POST',
    pathname: '/api/semesters',
    fields: new Set(['academicYear', 'term', 'startsOn', 'endsOn', 'rosterSource']),
    statusMessages: new Set([
      'Periksa kembali data yang dimasukkan.',
      'Pilih salin daftar semester sebelumnya atau mulai dengan daftar kosong.',
    ]),
  },
  {
    method: 'PATCH',
    pathname: /^\/api\/semesters\/[^/]+$/,
    fields: new Set(['semesterId', 'academicYear', 'term', 'startsOn', 'endsOn']),
    statusMessages: new Set(['Periksa kembali data yang dimasukkan.']),
  },
  {
    method: 'GET',
    pathname: /^\/api\/semesters\/[^/]+\/closure-preview$/,
    fields: new Set(['semesterId']),
    statusMessages: new Set(['Periksa kembali data yang dimasukkan.']),
  },
  {
    method: 'POST',
    pathname: /^\/api\/semesters\/[^/]+\/close$/,
    fields: new Set(['semesterId', 'previewToken']),
    statusMessages: new Set([
      'Periksa kembali data yang dimasukkan.',
      'Periksa kembali kelengkapan semester sebelum menutupnya.',
    ]),
  },
  {
    method: 'PUT',
    pathname: '/api/school',
    fields: new Set(['name', 'className', 'timeZone', 'logo']),
    statusMessages: new Set([
      'Periksa kembali data yang dimasukkan.',
      'Pilih zona waktu sekolah yang valid.',
      'Pilihan logo tidak valid. Muat ulang halaman lalu coba lagi.',
      'Periksa kembali pilihan dan berkas logo.',
    ]),
  },
  {
    method: 'POST',
    pathname: '/api/students/import/preview',
    fields: new Set(['semesterId']),
    statusMessages: new Set(['Periksa kembali data yang dimasukkan.']),
  },
  {
    method: 'POST',
    pathname: '/api/students/import/commit',
    fields: new Set(['semesterId']),
    statusMessages: new Set(['Periksa kembali data yang dimasukkan.']),
  },
]

const FALLBACK_COPY: Readonly<Record<number, string>> = {
  400: 'Data yang dikirim belum dapat dibaca. Periksa kembali lalu coba lagi.',
  408: 'Permintaan memerlukan waktu terlalu lama. Coba lagi.',
  401: 'Silakan masuk untuk melanjutkan.',
  403: 'Permintaan tidak dapat diproses.',
  404: 'Data tidak ditemukan.',
  409: 'Perubahan belum tersimpan. Muat ulang lalu coba lagi.',
  410: 'Data sudah tidak berlaku. Periksa kembali lalu coba lagi.',
  413: 'Data terlalu besar. Periksa ukuran berkas lalu coba lagi.',
  415: 'Format data tidak didukung.',
  422: 'Periksa kembali data yang dimasukkan.',
  429: 'Terlalu banyak permintaan. Coba lagi nanti.',
  503: 'Layanan belum tersedia.',
}

const HTTP_STATUS_TEXT: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  408: 'Request Timeout',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

const CALENDAR_CONFIRMATION_COPIES = new Set([
  'Tanggal ini memiliki catatan absensi. Periksa jumlah terbaru sebelum mengubah jenis hari.',
  'Jumlah absensi berubah. Periksa ringkasan terbaru sebelum mengonfirmasi kembali.',
])
const SEMESTER_PATCH_CONFLICT_REASONS: Readonly<Record<string, string>> = {
  'Periode baru tidak mencakup masa terdaftar siswa. Perbaiki tanggal siswa terlebih dahulu.': 'membership_period_conflict',
  'Periode baru tidak mencakup catatan absensi atau riwayat yang sudah ada.': 'attendance_period_conflict',
}
const CALENDAR_WRITE_REASON_RULES: Readonly<Record<string, { statusCode: number; reason: string }>> = {
  'Semester ini sudah menjadi arsip. Kalender hanya dapat dilihat.': { statusCode: 409, reason: 'semester_closed' },
  'Tanggal harus berada di dalam periode semester.': { statusCode: 422, reason: 'date_outside_semester' },
}
const ATTENDANCE_DAY_REASON_RULES = [
  { statusCode: 422, method: 'GET', statusMessage: 'Tanggal absensi harus berada di dalam periode semester.', reason: 'date_outside_semester' },
  { statusCode: 422, method: 'PUT', statusMessage: 'Tanggal absensi harus berada di dalam periode semester.', reason: 'date_outside_semester' },
  {
    statusCode: 409,
    method: 'PUT',
    statusMessage: 'Data daftar siswa, kalender, atau absensi berubah. Muat ulang setelah memutuskan untuk membuang perubahan yang belum disimpan.',
    reason: 'stale_day',
  },
  { statusCode: 409, method: 'PUT', statusMessage: 'Tanggal ini hanya dapat dilihat dan tidak menerima perubahan absensi.', reason: 'readOnlyReason' },
  { statusCode: 422, method: 'PUT', statusMessage: 'Ada siswa yang tidak memenuhi syarat untuk tanggal ini.', reason: 'ineligible_membership' },
] as const
const ATTENDANCE_READ_ONLY_REASONS = new Set([
  'semester_closed',
  'future_date',
  'calendar_holiday',
  'calendar_unset',
  'not_school_day',
])
const SEMESTER_PREVIEW_CHANGED_COPY = 'Data berubah sejak pemeriksaan terakhir. Periksa kembali jumlah absensi sebelum menutup semester.'

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

export function safeErrorStatusCode(error: unknown): number {
  const candidate = record(error)?.statusCode
  return typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate
    : 500
}

export function safeErrorStatusText(statusCode: number): string {
  return HTTP_STATUS_TEXT[statusCode] ?? 'Internal Server Error'
}

function genericErrorCopy(statusCode: number): string {
  return FALLBACK_COPY[statusCode] ?? 'Layanan belum tersedia.'
}

function isUnexpectedError(error: unknown): boolean {
  const value = record(error)
  return value?.unhandled === true || value?.fatal === true
}

export function safeErrorCopy(statusCode: number, error: unknown, request?: SafeErrorRequest): string {
  if (isUnexpectedError(error)) return genericErrorCopy(statusCode)
  const candidate = record(error)?.statusMessage
  const routeKey = request ? request.method + ' ' + request.pathname : ''
  const routeCopies = ROSTER_IMPORT_COPY_RULES[routeKey]
  if (routeCopies) {
    return typeof candidate === 'string' && routeCopies[statusCode]?.has(candidate)
      ? candidate
      : genericErrorCopy(statusCode)
  }
  if (typeof candidate === 'string' && SAFE_STATUS_COPIES.has(candidate)) return candidate
  return genericErrorCopy(statusCode)
}

function projectFieldErrors(value: unknown, allowedFields: ReadonlySet<string>): Record<string, string> | undefined {
  const source = record(value)
  if (!source) return undefined
  const output: Record<string, string> = {}
  for (const [field, message] of Object.entries(source)) {
    const allowedMessages = SAFE_FIELD_ERRORS[field]
    if (allowedFields.has(field) && allowedMessages && typeof message === 'string' && allowedMessages.has(message)) {
      output[field] = message
    }
  }
  return Object.keys(output).length ? output : undefined
}

function fieldErrorRule(request: SafeErrorRequest, statusMessage: unknown): FieldErrorRule | undefined {
  if (typeof statusMessage !== 'string') return undefined
  return FIELD_ERROR_RULES.find((rule) => {
    const pathMatches = typeof rule.pathname === 'string'
      ? request.pathname === rule.pathname
      : rule.pathname.test(request.pathname)
    return request.method === rule.method && pathMatches && rule.statusMessages.has(statusMessage)
  })
}

function nonNegativeIntegerOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function projectCalendarConfirmation(data: UnknownRecord): UnknownRecord | undefined {
  const reason = data.reason
  if (reason !== 'attendance_confirmation_required' && reason !== 'preview_changed') return undefined
  const impact = record(data.impact)
  const previewToken = data.previewToken
  if (!impact
    || !Number.isSafeInteger(impact.attendanceHistoryCount)
    || Number(impact.attendanceHistoryCount) < 0
    || !Number.isSafeInteger(impact.effectiveAttendanceCount)
    || Number(impact.effectiveAttendanceCount) < 0
    || typeof previewToken !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(previewToken)) return undefined

  return {
    reason,
    impact: {
      attendanceHistoryCount: impact.attendanceHistoryCount,
      effectiveAttendanceCount: impact.effectiveAttendanceCount,
    },
    previewToken,
  }
}

function projectSemesterClosurePreview(data: UnknownRecord): UnknownRecord | undefined {
  if (data.reason !== 'preview_changed') return undefined
  const preview = record(data.preview)
  const semester = record(preview?.semester)
  const term = semester?.term
  const status = semester?.status
  const schoolName = semester?.schoolName
  const className = semester?.className
  const academicYear = semester?.academicYear
  const startsOn = semester?.startsOn
  const endsOn = semester?.endsOn
  const previewToken = preview?.previewToken

  if (!preview || !semester
    || typeof semester.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(semester.id)
    || typeof academicYear !== 'string' || !/^\d{4}\/\d{4}$/.test(academicYear)
    || (term !== 'ganjil' && term !== 'genap')
    || !isIsoDate(startsOn) || !isIsoDate(endsOn)
    || (status !== 'active' && status !== 'closed')
    || typeof schoolName !== 'string' || schoolName.length > 120
    || typeof className !== 'string' || className.length > 80
    || typeof preview.calendarConfigured !== 'boolean'
    || !nonNegativeIntegerOrNull(preview.schoolDayCount)
    || !nonNegativeIntegerOrNull(preview.eligibleCellCount)
    || !nonNegativeIntegerOrNull(preview.filledCellCount)
    || !nonNegativeIntegerOrNull(preview.blankCellCount)
    || !nonNegativeIntegerOrNull(preview.incompleteSchoolDayCount)
    || typeof previewToken !== 'string' || !/^[0-9a-f]{32}$/i.test(previewToken)) return undefined

  return {
    reason: 'preview_changed',
    preview: {
      semester: {
        id: semester.id,
        academicYear,
        term,
        startsOn,
        endsOn,
        status,
        schoolName,
        className,
      },
      calendarConfigured: preview.calendarConfigured,
      schoolDayCount: preview.schoolDayCount,
      eligibleCellCount: preview.eligibleCellCount,
      filledCellCount: preview.filledCellCount,
      blankCellCount: preview.blankCellCount,
      incompleteSchoolDayCount: preview.incompleteSchoolDayCount,
      previewToken,
    },
  }
}

export function safeErrorData(
  error: unknown,
  statusCode: number,
  request: { method: string; pathname: string },
): UnknownRecord | undefined {
  if (isUnexpectedError(error)) return undefined
  if (statusCode !== 409 && statusCode !== 422) return undefined
  const data = record(record(error)?.data)
  if (!data) return undefined

  if (statusCode === 422) {
    const routeRule = fieldErrorRule(request, record(error)?.statusMessage)
    const fieldErrors = routeRule ? projectFieldErrors(data.fieldErrors, routeRule.fields) : undefined
    if (fieldErrors) return { fieldErrors }
  }

  const patchConflictMessage = record(error)?.statusMessage
  const isSemesterPatchConflict = statusCode === 409
    && request.method === 'PATCH'
    && /^\/api\/semesters\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.pathname)
    && typeof patchConflictMessage === 'string'
  if (isSemesterPatchConflict && typeof patchConflictMessage === 'string') {
    const expectedReason = SEMESTER_PATCH_CONFLICT_REASONS[patchConflictMessage]
    if (expectedReason && data.reason === expectedReason) return { reason: expectedReason }
  }

  const calendarWriteMessage = record(error)?.statusMessage
  const isCalendarWriteRoute = request.method === 'PUT'
    && (request.pathname === '/api/calendar/routine' || /^\/api\/calendar\/exceptions\/\d{4}-\d{2}-\d{2}$/.test(request.pathname))
  if (isCalendarWriteRoute && typeof calendarWriteMessage === 'string') {
    const rule = CALENDAR_WRITE_REASON_RULES[calendarWriteMessage]
    if (rule?.statusCode === statusCode && data.reason === rule.reason) return { reason: rule.reason }
  }

  const isAttendanceDayRoute = /^\/api\/attendance\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/\d{4}-\d{2}-\d{2}$/i.test(request.pathname)
  if (isAttendanceDayRoute) {
    const attendanceRule = ATTENDANCE_DAY_REASON_RULES.find((rule) =>
      rule.statusCode === statusCode
      && rule.method === request.method
      && rule.statusMessage === record(error)?.statusMessage,
    )
    if (attendanceRule) {
      if (attendanceRule.reason === 'readOnlyReason') {
        const reason = data.reason
        if (typeof reason === 'string' && ATTENDANCE_READ_ONLY_REASONS.has(reason)) return { reason }
      } else if (data.reason === attendanceRule.reason) {
        return { reason: attendanceRule.reason }
      }
    }
  }

  const isCalendarConfirmationRoute = statusCode === 409
    && typeof record(error)?.statusMessage === 'string'
    && CALENDAR_CONFIRMATION_COPIES.has(record(error)!.statusMessage as string)
    && request.method === 'PUT'
    && /^\/api\/calendar\/exceptions\/\d{4}-\d{2}-\d{2}$/.test(request.pathname)
  if (isCalendarConfirmationRoute) {
    const calendarConfirmation = projectCalendarConfirmation(data)
    if (calendarConfirmation) return calendarConfirmation
  }

  const isSemesterCloseRoute = statusCode === 409
    && record(error)?.statusMessage === SEMESTER_PREVIEW_CHANGED_COPY
    && request.method === 'POST'
    && /^\/api\/semesters\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/close$/i.test(request.pathname)
  if (isSemesterCloseRoute) {
    const semesterPreview = projectSemesterClosurePreview(data)
    if (semesterPreview) return semesterPreview
  }

  return undefined
}

export function safeHtmlErrorPage(statusCode: number, message: string): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${statusCode}</title></head><body><main><h1>Permintaan belum dapat diproses</h1><p>${escape(message)}</p></main></body></html>`
}
