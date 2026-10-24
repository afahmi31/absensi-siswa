import { randomUUID } from 'node:crypto'
import { requireAuthenticatedTeacher } from '../../auth/teacher-session.ts'
import { withAuditActor } from '../../database/audit-context.ts'
import { getDatabase } from '../../database/client.ts'
import {
  createSchool,
  createSchoolClass,
  createSchoolLogoAsset,
  findSchoolForTeacher,
  lockSchoolProfileSave,
  lockTeacherSchoolSave,
  updateSchoolClass,
  updateSchoolProfile,
} from '../../database/repositories/schools.ts'
import {
  isValidIanaTimeZone,
  requiredText,
  safeDatabaseError,
  validateRequestKeys,
} from '../../utils/study-api.ts'
import {
  readSchoolSaveBody,
  validateSchoolLogo,
  type ValidatedSchoolLogo,
} from '../../utils/school-logo.ts'
import {
  getLocalSchoolLogoStorage,
  type SchoolLogoStorageReceipt,
} from '../../utils/school-logo-storage.ts'

type LogoAction = 'keep' | 'replace' | 'clear'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const teacher = await requireAuthenticatedTeacher(event)
  const request = await readSchoolSaveBody(event)
  const body = request.metadata
  validateRequestKeys(body, ['name', 'className', 'timeZone', 'logoAction', 'principalName', 'principalNip', 'teacherName', 'teacherNip'])
  const signatures = Object.fromEntries(['principalName','principalNip','teacherName','teacherNip'].map(key => {
    if (body[key] === undefined) return [key, undefined]
    const value = body[key]
    if (typeof value !== 'string' || Array.from(value.trim()).length > (key.endsWith('Nip') ? 50 : 200)) throw createError({ statusCode: 422, statusMessage: 'Periksa kembali data yang dimasukkan.', data: { fieldErrors: { [key]: 'Identitas tidak valid atau terlalu panjang.' } } })
    return [key, value.trim()]
  }).filter(([,value]) => value !== undefined)) as Record<string, string>
  const name = requiredText(body.name, 'name', 'Nama sekolah', 120)
  const className = requiredText(body.className, 'className', 'Nama kelas', 80)
  const timeZone = body.timeZone === undefined
    ? 'Asia/Jakarta'
    : typeof body.timeZone === 'string' ? body.timeZone.trim() : ''
  if (!timeZone || timeZone.length > 100 || !isValidIanaTimeZone(timeZone)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Pilih zona waktu sekolah yang valid.',
      data: { fieldErrors: { timeZone: 'Pilih zona waktu sekolah yang valid.' } },
    })
  }

  const action = readLogoAction(body.logoAction, request.isMultipart)
  if (action === 'replace' && !request.logo) throw invalidLogoAction()
  if (action !== 'replace' && request.logo) throw invalidLogoAction()

  let validatedLogo: ValidatedSchoolLogo | undefined
  let storage: ReturnType<typeof getLocalSchoolLogoStorage> = null
  if (request.logo) {
    validatedLogo = await validateSchoolLogo(request.logo)
    storage = getLocalSchoolLogoStorage()
    if (!storage) throw logoStorageUnavailable()
  }

  const assetId = validatedLogo ? randomUUID() : null
  const newSchoolId = randomUUID()
  let storageReceipt: SchoolLogoStorageReceipt | undefined
  let saved: { id: string; name: string; timeZone: string; className: string; logoAssetId: string | null }

  if (validatedLogo && assetId && storage) storageReceipt = await writeLogo(storage, assetId, validatedLogo)

  try {
    const result = await withAuditActor(getDatabase(), teacher.id, async (transaction) => {
      // The teacher lock serializes both updates and first-school creation. Existing schools
      // take the semester-change lock before any row lock, matching archive closure ordering.
      await lockTeacherSchoolSave(transaction, teacher.id)
      let current = await findSchoolForTeacher(transaction, teacher.id)
      if (current) await lockSchoolProfileSave(transaction, current.id)
      else await lockSchoolProfileSave(transaction, newSchoolId)

      if (current) {
        const locked = await transaction<{ id: string; active_logo_asset_id: string | null }[]>`
          select id, active_logo_asset_id from schools where id = ${current.id} and teacher_id = ${teacher.id} for update
        `
        const school = locked[0]
        if (!school) throw new Error('School was not found.')
        current = { ...current, id: school.id }

        const existingClass = await transaction<{ id: string }[]>`
          select id from school_classes where school_id = ${school.id} for update
        `
        if (existingClass[0]) await updateSchoolClass(transaction, { schoolId: school.id, name: className })
        else await createSchoolClass(transaction, { schoolId: school.id, name: className })

        if (validatedLogo && assetId) {
          await createSchoolLogoAsset(transaction, {
            assetId,
            schoolId: school.id,
            mimeType: validatedLogo.mimeType,
            byteSize: validatedLogo.bytes.length,
            width: validatedLogo.width,
            height: validatedLogo.height,
            sha256: validatedLogo.sha256,
            uploadedBy: teacher.id,
          })
        }

        const activeLogoAssetId = action === 'clear'
          ? null
          : action === 'replace' ? assetId : school.active_logo_asset_id
        const updated = await updateSchoolProfile(transaction, {
          ...signatures,
          teacherId: teacher.id,
          schoolId: school.id,
          name,
          timeZone,
          activeLogoAssetId,
        })
        return { principalName: updated.principalName, principalNip: updated.principalNip, teacherName: updated.teacherName, teacherNip: updated.teacherNip, id: updated.id, name: updated.name, timeZone: updated.time_zone, className, logoAssetId: activeLogoAssetId }
      }

      const created = await createSchool(transaction, { id: newSchoolId, teacherId: teacher.id, name, timeZone, ...signatures })
      await createSchoolClass(transaction, { schoolId: created.id, name: className })
      if (validatedLogo && assetId) {
        await createSchoolLogoAsset(transaction, {
          assetId,
          schoolId: created.id,
          mimeType: validatedLogo.mimeType,
          byteSize: validatedLogo.bytes.length,
          width: validatedLogo.width,
          height: validatedLogo.height,
          sha256: validatedLogo.sha256,
          uploadedBy: teacher.id,
        })
      }
      const activeLogoAssetId = action === 'replace' ? assetId : null
      if (activeLogoAssetId) {
        await updateSchoolProfile(transaction, {
          ...signatures,
          teacherId: teacher.id,
          schoolId: created.id,
          name,
          timeZone,
          activeLogoAssetId,
        })
      }
      return { id: created.id, name: created.name, timeZone: created.time_zone, className, ...signatures, logoAssetId: activeLogoAssetId }
    })
    saved = result
  } catch (error) {
    if (storageReceipt && assetId && validatedLogo && storage) {
      await storage.removeCreated(assetId, validatedLogo.mimeType, storageReceipt).catch(() => undefined)
    }
    safeDatabaseError(error)
  }

  return { ok: true, school: saved }
})

function readLogoAction(value: unknown, isMultipart: boolean): LogoAction {
  if (value === undefined && !isMultipart) return 'keep'
  if (value === 'keep' || value === 'replace' || value === 'clear') return value
  throw createError({
    statusCode: 422,
    statusMessage: 'Pilihan logo tidak valid. Muat ulang halaman lalu coba lagi.',
    data: { fieldErrors: { logo: 'Pilihan logo tidak valid.' } },
  })
}

function invalidLogoAction(): never {
  throw createError({
    statusCode: 422,
    statusMessage: 'Periksa kembali pilihan dan berkas logo.',
    data: { fieldErrors: { logo: 'Pilih satu berkas untuk mengganti logo, atau hapus pilihan berkas.' } },
  })
}

function logoStorageUnavailable(): ReturnType<typeof createError> {
  return createError({ statusCode: 503, statusMessage: 'Logo belum tersedia di lingkungan ini. Data sekolah tetap dapat disimpan.' })
}

async function writeLogo(
  storage: NonNullable<ReturnType<typeof getLocalSchoolLogoStorage>>,
  assetId: string,
  logo: ValidatedSchoolLogo,
): Promise<SchoolLogoStorageReceipt> {
  try {
    return await storage.write(assetId, logo.mimeType, logo.bytes)
  } catch {
    throw logoStorageUnavailable()
  }
}
