import { createHash } from 'node:crypto'
import { send } from 'h3'
import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { findSchoolLogoForTeacher } from '../../../database/repositories/schools.ts'
import { isUuid } from '../../../utils/study-api.ts'
import { getLocalSchoolLogoStorage, SchoolLogoStorageError } from '../../../utils/school-logo-storage.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  const teacher = await requireAuthenticatedTeacher(event)
  const assetId = getRouterParam(event, 'assetId')
  if (!isUuid(assetId)) throw logoNotFound()

  let asset
  try {
    asset = await findSchoolLogoForTeacher(getDatabase(), { teacherId: teacher.id, assetId })
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Logo sekolah belum dapat dimuat. Coba lagi.' })
  }
  if (!asset || !isLogoMime(asset.mime_type)) throw logoNotFound()

  const storage = getLocalSchoolLogoStorage()
  if (!storage) throw createError({ statusCode: 503, statusMessage: 'Logo belum tersedia di lingkungan ini. Data sekolah tetap dapat digunakan.' })

  let bytes: Buffer
  try {
    bytes = await storage.read(asset.id, asset.mime_type)
  } catch (error) {
    if (error instanceof SchoolLogoStorageError && error.kind === 'missing') throw logoNotFound()
    throw createError({ statusCode: 503, statusMessage: 'Logo sekolah belum dapat dimuat. Coba lagi.' })
  }
  if (bytes.length !== asset.byte_size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw createError({ statusCode: 503, statusMessage: 'Logo sekolah belum dapat dimuat. Coba lagi.' })
  }

  setResponseHeader(event, 'content-length', bytes.length)
  setResponseHeader(event, 'content-disposition', `inline; filename="school-logo.${asset.mime_type === 'image/png' ? 'png' : 'jpg'}"`)
  return await send(event, bytes, asset.mime_type)
})

function isLogoMime(value: string): value is 'image/png' | 'image/jpeg' {
  return value === 'image/png' || value === 'image/jpeg'
}

function logoNotFound(): ReturnType<typeof createError> {
  return createError({ statusCode: 404, statusMessage: 'Logo sekolah tidak ditemukan.' })
}
