import Busboy from 'busboy'
import { Transform } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { IMPORT_FILE_BYTES,IMPORT_REQUEST_BYTES,ImportError } from './roster-import-validation.ts'
export async function readRosterUpload(request:IncomingMessage):Promise<{bytes:Buffer;semesterId:string}> {
  if(Number(request.headers['content-length'])>IMPORT_REQUEST_BYTES)throw new ImportError(413,'Berkas maksimal 4 MiB.')
  return new Promise((resolve,reject)=>{
    let count=0,semesterId='',fileCount=0,settled=false,fileDone=false;const chunks:Buffer[]=[]
    const fail=(error:unknown)=>{if(settled)return;settled=true;request.unpipe(limit);limit.unpipe(parser);parser.destroy();limit.destroy();request.pause();reject(error instanceof ImportError?error:new ImportError(400,'Berkas belum dapat dibaca. Pilih berkas .xlsx sesuai template.'))}
    let parser:ReturnType<typeof Busboy>
    // Busboy emits partsLimit when the threshold is reached, including a valid
    // second part. Threshold 3 plus files:1/fields:1 enforces exactly two parts.
    try{parser=Busboy({headers:request.headers,limits:{fileSize:IMPORT_FILE_BYTES,files:1,fields:1,parts:3,fieldSize:2048,headerPairs:50}})}catch(error){reject(new ImportError(415,'Pilih berkas .xlsx sesuai template.'));return}
    const limit=new Transform({transform(chunk:Buffer,_encoding,done){count+=chunk.length;done(count>IMPORT_REQUEST_BYTES?new ImportError(413,'Berkas maksimal 4 MiB.'):null,chunk)}})
    const timer=setTimeout(()=>fail(new ImportError(408,'Unggahan terlalu lama. Coba pilih berkas lagi.')),15000)
    const finish=()=>{clearTimeout(timer);request.off('aborted',aborted);request.off('error',requestError)}
    const aborted=()=>fail(new ImportError(400,'Unggahan terhenti. Pilih berkas lagi.'))
    const requestError=()=>fail(new ImportError(400,'Unggahan terhenti. Pilih berkas lagi.'))
    request.once('aborted',aborted)
    request.once('error',requestError)
    parser.on('file',(name,file,info)=>{
      fileCount++;if(name!=='file'||!info.filename?.toLowerCase().endsWith('.xlsx')){file.resume();fail(new ImportError(415,'Pilih berkas .xlsx sesuai template.'));return}
      file.once('limit',()=>fail(new ImportError(413,'Berkas maksimal 4 MiB.')))
      file.on('data',(chunk:Buffer)=>{if(!settled)chunks.push(chunk)})
      file.once('end',()=>{fileDone=true});file.once('error',fail)
    })
    parser.on('field',(name,value,info)=>{if(name!=='semesterId'||info.valueTruncated||semesterId)fail(new ImportError(422,'Semester unggahan tidak valid.'));else semesterId=value})
    for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>fail(new ImportError(422,'Unggah satu berkas dan satu pilihan semester.')))
    parser.once('error',fail);limit.once('error',fail)
    parser.once('close',()=>{if(settled)return;settled=true;finish();if(fileCount!==1||!fileDone||!semesterId){reject(new ImportError(422,'Pilih berkas dan semester terlebih dahulu.'));return}resolve({bytes:Buffer.concat(chunks),semesterId})})
    request.pipe(limit).pipe(parser)
    // Every failure releases listeners/deadline, including disconnect and stream limits.
    limit.once('close',()=>{if(settled)finish()})
  })
}
