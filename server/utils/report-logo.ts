import { createHash } from 'node:crypto'
import type { AttendanceReportLogo } from '../../app/types/attendance-report.ts'
import { getLocalSchoolLogoStorage } from './school-logo-storage.ts'
import { validateSchoolLogo } from './school-logo.ts'

/** Descriptor comes only from the owner-scoped report query, never from request input. */
export async function readAttendanceReportLogo(logo: AttendanceReportLogo | null | undefined): Promise<Buffer | null> {
  if (!logo) return null
  const storage = getLocalSchoolLogoStorage()
  if (!storage) throw new Error('Report logo unavailable.')
  const bytes = await storage.read(logo.assetId, logo.mimeType)
  if (bytes.length !== logo.byteSize || createHash('sha256').update(bytes).digest('hex') !== logo.sha256) {
    throw new Error('Report logo unavailable.')
  }
  const decoded = await validateSchoolLogo({ bytes, mimeType: logo.mimeType })
  if (decoded.width !== logo.width || decoded.height !== logo.height) throw new Error('Report logo unavailable.')
  return bytes
}
