import { H3Error } from 'h3'

export const IMPORT_FILE_BYTES = 4194304
export const IMPORT_REQUEST_BYTES = 4259840
export const IMPORT_HEADERS = ['Nama','NIPD','Jenis Kelamin','Tanggal Masuk','Tanggal Keluar']
export interface ImportRow {
  rowId: number; values: string[]; errors: string[]; duplicate: boolean
}
export class ImportError extends H3Error {
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ImportError'
    this.statusCode = statusCode
    this.statusMessage = message
  }
}
export const normalizeImportName = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase()
export function validImportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date=new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value
}
export function validateImportRows(rows: ImportRow[], scope: {starts_on:string;ends_on:string}, names: string[]): ImportRow[] {
  const existing=new Set(names.map(normalizeImportName)), counts=new Map<string,number>()
  for(const row of rows) { const key=normalizeImportName(row.values[0]??''); if(key) counts.set(key,(counts.get(key)??0)+1) }
  return rows.map(row=>{
    const values=row.values.map(value=>value.trim()), errors=[...row.errors]
    const name=values[0]??'', nipd=values[1]??'', gender=values[2]??''
    const start=values[3]||scope.starts_on, end=values[4]||''
    if(!name)errors.push('Nama siswa wajib diisi.')
    if(name.length>200)errors.push('Nama maksimal 200 karakter.')
    if(nipd.length>80)errors.push('NIPD maksimal 80 karakter.')
    if(!['','L','P'].includes(gender))errors.push('Jenis kelamin harus kosong, L, atau P.')
    if(!validImportDate(start)||start<scope.starts_on||start>scope.ends_on)errors.push('Tanggal masuk harus berupa YYYY-MM-DD di dalam semester.')
    if(end&&(!validImportDate(end)||end<start||end>scope.ends_on))errors.push('Tanggal keluar harus di dalam semester dan tidak sebelum tanggal masuk.')
    const key=normalizeImportName(name)
    return {rowId:row.rowId,values:[name,nipd,gender,start,end],errors:[...new Set(errors)],duplicate:Boolean(key&&(existing.has(key)||(counts.get(key)??0)>1))}
  })
}
