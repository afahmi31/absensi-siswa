import { requireAuthenticatedTeacher } from '../../../auth/teacher-session.ts'
import { getDatabase } from '../../../database/client.ts'
import { commitRosterImport,type ImportChoice } from '../../../database/repositories/roster-imports.ts'
import { requiredUuid,safeDatabaseError,validateRequestKeys } from '../../../utils/study-api.ts'
export default defineEventHandler(async(event)=>{
  setResponseHeader(event,'cache-control','no-store')
  const teacher=await requireAuthenticatedTeacher(event)
  // readValidatedBody would buffer unbounded input; consume a small bounded stream first.
  let size=0;const chunks:Buffer[]=[]
  for await(const chunk of event.node.req){size+=chunk.length;if(size>65536)throw createError({statusCode:413,statusMessage:'Pilihan impor terlalu besar.'});chunks.push(chunk)}
  let body:Record<string,unknown>
  try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||Array.isArray(body)||typeof body!=='object')throw new Error()}catch{throw createError({statusCode:400,statusMessage:'Pilihan impor tidak dapat dibaca.'})}
  validateRequestKeys(body,['semesterId','token','choices'])
  const semesterId=requiredUuid(body.semesterId,'semesterId','Semester')
  if(typeof body.token!=='string'||!Array.isArray(body.choices)||body.choices.length>500||body.choices.some(c=>!c||typeof c!=='object'||!Number.isInteger(c.rowId)))throw createError({statusCode:422,statusMessage:'Pilihan impor tidak valid.'})
  try{return await commitRosterImport(getDatabase(),teacher.id,semesterId,body.token,body.choices as ImportChoice[])}catch(error){safeDatabaseError(error)}
})
