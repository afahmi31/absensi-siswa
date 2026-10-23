import ExcelJS from 'exceljs'
import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'
import { IMPORT_HEADERS,IMPORT_FILE_BYTES,ImportError,type ImportRow } from './roster-import-validation.ts'
import { ROSTER_WORKER } from './roster-import-worker.ts'
// Nitro 2.13.4 rewrites the dotted import.meta.url form to a shared placeholder.
// Reflect preserves this module's native URL without changing other modules.
const nativeUrl=Reflect.get(import.meta,'url') as string
if(typeof nativeUrl!=='string'||!nativeUrl.startsWith('file:'))throw new Error('Import parser requires a native file module.')
const require=createRequire(nativeUrl)
let activeParsers=0
export async function createRosterTemplate():Promise<Buffer> {
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Siswa')
  sheet.addRow(IMPORT_HEADERS)
  sheet.columns.forEach((column,index)=>{column.width=index===0?32:22;column.numFmt='@'})
  return Buffer.from(await book.xlsx.writeBuffer())
}
export async function parseRosterWorkbook(bytes:Buffer, deadlineMs=10000):Promise<ImportRow[]> {
  if(!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>10000)throw new Error('Invalid parser deadline.')
  if(bytes.length>IMPORT_FILE_BYTES)throw new ImportError(413,'Berkas maksimal 4 MiB. Kurangi ukuran lalu pilih kembali.')
  if(activeParsers>=2)throw new ImportError(429,'Pemeriksaan berkas sedang penuh. Coba lagi sebentar.')
  activeParsers++
  try{return await new Promise<ImportRow[]>((resolve,reject)=>{
    const worker=new Worker(ROSTER_WORKER,{eval:true,execArgv:[],workerData:{bytes,modules:{exceljs:require.resolve('exceljs'),yauzl:require.resolve('yauzl'),saxes:require.resolve('saxes')}},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}})
    let settled=false
    const finish=async(rows?:ImportRow[])=>{if(settled)return;settled=true;clearTimeout(timer);await worker.terminate();rows?resolve(rows):reject(new ImportError(422,'Berkas tidak sesuai template atau melewati batas aman. Gunakan satu lembar tanpa rumus atau objek, maksimal 500 baris.'))}
    const timer=setTimeout(()=>finish(),deadlineMs)
    worker.once('message',message=>finish(message.rows));worker.once('error',()=>finish());worker.once('exit',()=>finish())
  })}finally{activeParsers--}
}
