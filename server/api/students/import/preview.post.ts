import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { previewRosterImport } from '../../../database/repositories/roster-imports.ts'
import { readRosterUpload } from '../../../utils/roster-import-upload.ts'
import { parseRosterWorkbook } from '../../../utils/roster-import-xlsx.ts'
import { requiredUuid,safeDatabaseError } from '../../../utils/study-api.ts'
export default defineEventHandler(async(event)=>{
  setResponseHeader(event,'cache-control','no-store')
  const teacher=await requireAuthenticatedTeacher(event)
  try {
    const upload=await readRosterUpload(event.node.req),semesterId=requiredUuid(upload.semesterId,'semesterId','Semester')
    const rows=await parseRosterWorkbook(upload.bytes)
    return await previewRosterImport(getDatabase(),teacher.id,semesterId,rows)
  }catch(error){setResponseHeader(event,'connection','close');safeDatabaseError(error)}
})
