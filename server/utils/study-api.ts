const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type JsonRecord = Record<string, unknown>

const forbiddenIdentityKeys = new Set([
  'actor', 'actorid', 'teacher', 'teacherid', 'owner', 'ownerid', 'userid',
  'school', 'schoolid', 'schoolclass', 'schoolclassid', 'student', 'studentid',
  'membership', 'membershipid',
])

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readJsonRecord(event: Parameters<typeof readBody>[0]): Promise<JsonRecord> {
  let value: unknown
  try {
    value = await readBody(event)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
  }
  if (!isJsonRecord(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
  }
  return value
}

export function validateRequestKeys(body: JsonRecord, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed)
  const forbidden = Object.keys(body).some((key) => forbiddenIdentityKeys.has(key.toLowerCase().replace(/[^a-z0-9]/g, '')))
  if (forbidden) {
    throw createError({ statusCode: 422, statusMessage: 'Identitas pemilik tidak dapat diubah dari formulir.' })
  }
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw createError({ statusCode: 422, statusMessage: 'Ada kolom formulir yang tidak dikenali.' })
  }
}

export function fieldValidationError(fieldErrors: Record<string, string>): never {
  throw createError({
    statusCode: 422,
    statusMessage: 'Periksa kembali data yang dimasukkan.',
    data: { fieldErrors },
  })
}

export function requiredText(value: unknown, field: string, label: string, maximum: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  const errors: Record<string, string> = {}
  if (!text) errors[field] = `${label} wajib diisi.`
  else if (text.length > maximum) errors[field] = `${label} maksimal ${maximum} karakter.`
  if (Object.keys(errors).length) fieldValidationError(errors)
  return text
}

export function optionalText(value: unknown, field: string, label: string, maximum: number): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    fieldValidationError({ [field]: `${label} tidak valid.` })
  }
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > maximum) fieldValidationError({ [field]: `${label} maksimal ${maximum} karakter.` })
  return text || null
}

export function optionalGender(value: unknown): 'L' | 'P' | null {
  if (value === undefined || value === null || value === '') return null
  if (value === 'L' || value === 'P') return value
  fieldValidationError({ gender: 'Pilih laki-laki, perempuan, atau kosongkan.' })
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

export function requiredUuid(value: unknown, field: string, label: string): string {
  if (!isUuid(value)) fieldValidationError({ [field]: `${label} tidak valid.` })
  return value
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]!
}

export function optionalIsoDate(value: unknown, field: string, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (!isIsoDate(value)) fieldValidationError({ [field]: `${label} harus berupa tanggal yang benar.` })
  return value
}

export function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

export function safeDatabaseError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode)
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) throw error
  }

  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code === '55000') {
    throw createError({ statusCode: 409, statusMessage: 'Semester arsip terkunci atau tanggal tidak dapat mengecualikan catatan absensi yang sudah ada.' })
  }
  if (code === '23505' || code === '23P01') {
    throw createError({ statusCode: 409, statusMessage: 'Data bertentangan dengan catatan yang sudah ada. Periksa semester dan siswa.' })
  }
  if (code === '23514' || code === '22007' || code === '22008') {
    throw createError({ statusCode: 422, statusMessage: 'Sebagian data tidak sesuai dengan periode atau pengaturan sekolah.' })
  }
  if (code === '23503') {
    throw createError({ statusCode: 404, statusMessage: 'Data sekolah, semester, atau siswa tidak ditemukan.' })
  }
  throw createError({ statusCode: 503, statusMessage: 'Perubahan belum tersimpan. Coba lagi.' })
}
