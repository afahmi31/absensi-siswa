import { createHash,randomBytes } from 'node:crypto'
import { withAuditActor } from '../audit-context.ts'
import type { DatabaseExecutor } from '../transaction.ts'
import { lockSchoolSemesterChanges } from './semesters.ts'
import { createStudent,addStudentToSemester } from './students.ts'
import { ImportError,validateImportRows,type ImportRow } from '../../utils/roster-import-validation.ts'

const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
interface Scope {school_id:string;class_id:string;starts_on:string;ends_on:string;status:string}
async function lockScope(db:DatabaseExecutor,teacherId:string,semesterId:string):Promise<Scope> {
  const [hint]=await db`select s.school_id from semesters s join schools c on c.id=s.school_id where s.id=${semesterId} and c.teacher_id=${teacherId}`
  if(!hint)throw new ImportError(404,'Semester tidak ditemukan atau tidak dapat diakses.')
  await lockSchoolSemesterChanges(db,hint.school_id)
  const [scope]=await db<Scope[]>`select s.school_id,c.id as class_id,s.starts_on::text,s.ends_on::text,s.status from semesters s join schools school on school.id=s.school_id join school_classes c on c.school_id=s.school_id where s.id=${semesterId} and school.teacher_id=${teacherId} for share of s,school,c`
  if(!scope)throw new ImportError(409,'Data kelas belum siap. Periksa data sekolah.')
  return scope
}
async function roster(db:DatabaseExecutor,semesterId:string,scope:Scope) {
  const rows=await db`select id,student_id,name_snapshot,student_number_snapshot,gender_snapshot,starts_on::text,ends_on::text from semester_memberships where semester_id=${semesterId} order by id`
  return {version:hash(JSON.stringify([scope,rows])),names:rows.map(row=>String(row.name_snapshot))}
}
export async function cleanupImportDrafts(db:DatabaseExecutor) {
  await db`delete from private.roster_import_drafts where token_hash in (select token_hash from private.roster_import_drafts where expires_at<=clock_timestamp() order by expires_at limit 100 for update skip locked)`
}
export async function previewRosterImport(db:DatabaseExecutor,teacherId:string,semesterId:string,input:ImportRow[]) {
  if(!input.length||input.length>500)throw new ImportError(422,'Berkas harus berisi 1 sampai 500 baris siswa.')
  return withAuditActor(db,teacherId,async tx=>{
    const scope=await lockScope(tx,teacherId,semesterId)
    if(scope.status!=='active')throw new ImportError(409,'Semester ini sudah menjadi arsip dan hanya dapat dilihat.')
    const current=await roster(tx,semesterId,scope), rows=validateImportRows(input,scope,current.names)
    const token=randomBytes(32).toString('base64url')
    await cleanupImportDrafts(tx)
    await tx`delete from private.roster_import_drafts where teacher_id=${teacherId} and semester_id=${semesterId}`
    const [draft]=await tx`insert into private.roster_import_drafts(token_hash,teacher_id,school_id,semester_id,roster_version,rows) values(${hash(token)},${teacherId},${scope.school_id},${semesterId},${current.version},${tx.json(rows as never)}) returning expires_at`
    return {token,expiresAt:draft!.expires_at,rows}
  })
}
export interface ImportChoice {rowId:number;action:'include'|'add-distinct'|'skip'}
export interface ImportResult {count:number;membershipIds:string[]}
export async function commitRosterImport(db:DatabaseExecutor,teacherId:string,semesterId:string,token:string,choices:ImportChoice[]):Promise<ImportResult> {
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ImportError(404,'Pratinjau tidak ditemukan. Periksa berkas lagi.')
  return withAuditActor(db,teacherId,async tx=>{
    const scope=await lockScope(tx,teacherId,semesterId), tokenHash=hash(token)
    const [receipt]=await tx`select result from private.roster_import_receipts where token_hash=${tokenHash} and teacher_id=${teacherId} and semester_id=${semesterId}`
    if(receipt)return receipt.result as ImportResult
    const [draft]=await tx`select rows,roster_version,expires_at>clock_timestamp() as valid from private.roster_import_drafts where token_hash=${tokenHash} and teacher_id=${teacherId} and semester_id=${semesterId} for update`
    if(!draft||!draft.valid)throw new ImportError(410,'Pratinjau kedaluwarsa. Periksa berkas lagi sebelum mengimpor.')
    if(scope.status!=='active')throw new ImportError(409,'Semester ini sudah menjadi arsip dan hanya dapat dilihat.')
    const current=await roster(tx,semesterId,scope)
    if(current.version!==draft.roster_version)throw new ImportError(409,'Daftar siswa atau semester berubah. Periksa berkas lagi sebelum mengimpor.')
    const stored=draft.rows as ImportRow[], rows=validateImportRows(stored,scope,current.names)
    if(!Array.isArray(choices)||choices.length!==rows.length||new Set(choices.map(c=>c.rowId)).size!==rows.length)throw new ImportError(422,'Tentukan pilihan untuk setiap baris.')
    const selected:ImportRow[]=[]
    for(const row of rows) {
      const choice=choices.find(c=>c.rowId===row.rowId)
      if(!choice||!['include','add-distinct','skip'].includes(choice.action)||Object.keys(choice).some(key=>!['rowId','action'].includes(key)))throw new ImportError(422,'Pilihan baris tidak valid.')
      if(choice.action==='skip')continue
      if(row.errors.length)throw new ImportError(422,'Ada baris terpilih yang perlu diperbaiki. Lewati baris tersebut atau perbaiki berkas.')
      if(row.duplicate&&choice.action!=='add-distinct')throw new ImportError(422,'Pilih tambah sebagai siswa berbeda atau lewati untuk setiap nama sama.')
      selected.push(row)
    }
    if(!selected.length)throw new ImportError(422,'Pilih setidaknya satu siswa untuk diimpor.')
    const membershipIds:string[]=[]
    for(const row of selected) {
      const [fullName,studentNumber,gender,startsOn,endsOn]=row.values
      const student=await createStudent(tx,{fullName:fullName!,studentNumber:studentNumber||null,gender:(gender||null) as 'L'|'P'|null})
      const membership=await addStudentToSemester(tx,{semesterId,schoolId:scope.school_id,schoolClassId:scope.class_id,studentId:student.id,startsOn:startsOn!,endsOn:endsOn||null})
      membershipIds.push(membership.id)
    }
    const result={count:membershipIds.length,membershipIds}
    await tx`insert into private.roster_import_receipts(token_hash,teacher_id,semester_id,result) values(${tokenHash},${teacherId},${semesterId},${tx.json(result)})`
    await tx`delete from private.roster_import_drafts where token_hash=${tokenHash}`
    return result
  })
}
