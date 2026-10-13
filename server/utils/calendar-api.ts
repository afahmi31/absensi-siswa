import { safeDatabaseError } from './study-api.ts'

export function safeCalendarDatabaseError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode)
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) throw error
  }

  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code === '55000') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Perubahan kalender tidak disimpan karena dapat mengubah absensi lama atau periode semester yang sudah ditutup.',
    })
  }
  safeDatabaseError(error)
}
