import { createRosterTemplate } from '../../../utils/roster-import-xlsx.ts'
export default defineEventHandler(async(event)=>{
  setResponseHeaders(event,{'cache-control':'no-store','content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="template-siswa.xlsx"'})
  return createRosterTemplate()
})
