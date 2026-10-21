import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID, randomBytes } from 'node:crypto'
import { readFile, readdir, writeFile, unlink, rename, lstat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import net from 'node:net'
import { createApp, eventHandler, readBody, setResponseStatus, toNodeListener, useSession } from 'h3'
import path from 'node:path'
import sharp from 'sharp'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { createTeacherSession, findTeacherSession, findTeacherAuthenticationByEmail } from '../server/database/repositories/teacher-accounts.ts'
import { createSchool, createSchoolClass, createSchoolLogoAsset, setActiveSchoolLogo } from '../server/database/repositories/schools.ts'
import { createSemester, closeSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { saveSchoolRoutine, setCalendarException } from '../server/database/repositories/calendar.ts'
import { getAttendanceDayView, saveAttendanceDay } from '../server/database/repositories/attendance-days.ts'
import { getAttendanceReport } from '../server/database/repositories/reports.ts'
import { LocalSchoolLogoStorage } from '../server/utils/school-logo-storage.ts'
import { newCluster, clusterConnection, verifyCluster, destroyCluster, connect, pgTool, connectionArgs } from '../scripts/local-backup-postgres.mjs'
import { fixtureSource, fixturePaths, createBackup, restoreTest, validatePackage, TABLES, schemaDescriptor, parseDump, buildRestoreSql } from '../scripts/local-backup-core.mjs'
import { sha256, APP_ROOT, TEST_ROOT, ownedDirectory, writePrivate, publish, cleanup, verifyOwned, privateAcl } from '../scripts/local-backup-files.mjs'

const hasher = new Scrypt({})
async function authHarness(db: any, seal: string) {
  const app=createApp()
  app.use(eventHandler(async(event)=>{
    const session=await useSession<any>(event,{name:'backup-test',password:seal,cookie:{secure:false,httpOnly:true,sameSite:'lax'},maxAge:3600})
    if(event.path==='/login'&&event.method==='POST') {
      const body=await readBody(event)
      const account=await findTeacherAuthenticationByEmail(db,body.email)
      if(!account?.passwordHash||!await hasher.verify(account.passwordHash,body.password)){setResponseStatus(event,401);return {ok:false}}
      const id=randomUUID(); await createTeacherSession(db,account.id,id,account.sessionVersion,new Date(Date.now()+3600000))
      await session.update({teacher:account.id,version:account.sessionVersion,id})
      return {ok:true}
    }
    const row=session.data.teacher?await findTeacherSession(db,session.data.teacher,session.data.id):null
    if(!row?.isSessionActive||row.sessionVersion!==session.data.version){setResponseStatus(event,401);return {ok:false}}
    return {ok:true}
  }))
  const server=createServer(toNodeListener(app))
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address() as any
  return {url:`http://127.0.0.1:${address.port}`,async close(){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}}
}
async function fullRows(db: any) {
  const rows: any = {}
  for (const table of TABLES) rows[table] = await db.unsafe(`select row_to_json(t)::text as row from public.${table} t order by row_to_json(t)::text COLLATE "C"`)
  return JSON.parse(JSON.stringify(rows))
}

test('synthetic roundtrip, snapshot concurrency, corruption, domain rollback and atomic private publication', { timeout: 300000 }, async (t) => {
  const cloudHash = sha256(await readFile(path.join(APP_ROOT,'scripts/cloud-data-transfer-core.mjs')))
  const cap = await newCluster()
  const db = connect(await clusterConnection(cap))
  try {
    await runMigrations(db)
    const teacher = await provisionTeacherAccount(db,'backup-fixture@example.invalid',await hasher.make('synthetic-password-only-123'))
    const actor = (action: any) => withAuditActor(db,teacher.id,action)
    const school = await createSchool(db,{teacherId:teacher.id,name:'Sekolah Sintetis',timeZone:'Asia/Jakarta'})
    const cls = await createSchoolClass(db,{schoolId:school.id,name:'Kelas Uji'})
    const source = await fixtureSource(cap)
    const paths = await fixturePaths(source)
    const logo = async (mime: 'image/png'|'image/jpeg') => {
      const id = randomUUID(); const image = sharp({create:{width:24,height:16,channels:3,background:mime==='image/png'?'#169e66':'#e87522'}})
      const bytes = await (mime==='image/png'?image.png():image.jpeg()).toBuffer()
      await new LocalSchoolLogoStorage(paths.logos).write(id,mime,bytes)
      await actor(async (tx: any) => { await createSchoolLogoAsset(tx,{assetId:id,schoolId:school.id,mimeType:mime,byteSize:bytes.length,width:24,height:16,sha256:sha256(bytes),uploadedBy:teacher.id}); await setActiveSchoolLogo(tx,{schoolId:school.id,assetId:id}) })
      return {id,bytes}
    }
    let semesterNumber=2021
    const semester = async (start: string,end: string) => { const year=semesterNumber++; return actor((tx: any)=>createSemester(tx,{schoolId:school.id,academicYear:`${year}/${year+1}`,term:'genap',startsOn:start,endsOn:end})) }
    const close = async (id: string) => { const preview=await getSemesterClosurePreview(db,{semesterId:id,teacherId:teacher.id}); assert.ok(preview); await actor((tx: any)=>closeSemester(tx,{semesterId:id,teacherId:teacher.id,confirmed:true,previewToken:preview.previewToken})) }
    const legacy=await semester('2023-01-01','2023-01-31'); await close(legacy.id)
    const a=await logo('image/png')
    const old=await semester('2023-02-01','2023-02-28'); await close(old.id)
    const b=await logo('image/jpeg')
    const active=await semester('2024-02-01','2024-02-29')
    await actor((tx: any)=>saveSchoolRoutine(tx,{teacherId:teacher.id,effectiveFrom:'2024-02-01',schoolDays:[1,2,3,4,5]}))
    const student=await createStudent(db,{fullName:'Siswa Sintetis',studentNumber:'001',gender:'P'})
    const membership=await actor((tx: any)=>addStudentToSemester(tx,{semesterId:active.id,schoolId:school.id,schoolClassId:cls.id,studentId:student.id,startsOn:'2024-02-01',endsOn:'2024-02-28'}))
    const save=async (date: string,status: any)=>{const input={teacherId:teacher.id,semesterId:active.id,date,revisionSecret:'synthetic-revision-secret-long-enough-only'};const view=await getAttendanceDayView(db,input);assert.ok(view);await actor((tx: any)=>saveAttendanceDay(tx,{...input,revision:view.revision,entries:[{membershipId:membership.id,status}]}))}
    await save('2024-02-01','H'); await save('2024-02-02','S'); await save('2024-02-05','I'); await save('2024-02-06','A')
    await save('2024-02-07','H'); await save('2024-02-07',null)
    await save('2024-02-08','S')
    await actor((tx: any)=>setCalendarException(tx,{schoolId:school.id,date:'2024-02-08',kind:'holiday',confirmedAttendanceImpact:true,note:'Sintetis'}))
    const sessionId=randomUUID(); await createTeacherSession(db,teacher.id,sessionId,1,new Date(Date.now()+3600000))
    const oldSeal=randomBytes(48).toString('base64url')
    const sourceAuth=await authHarness(db,oldSeal)
    let oldCookie=''
    try {
      const login=await fetch(`${sourceAuth.url}/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:teacher.email,password:'synthetic-password-only-123'}),signal:AbortSignal.timeout(5000)})
      assert.equal(login.status,200)
      oldCookie=login.headers.get('set-cookie')?.split(';')[0]??'';assert.ok(oldCookie)
      assert.equal((await fetch(sourceAuth.url,{headers:{cookie:oldCookie},signal:AbortSignal.timeout(5000)})).status,200)
    } finally {await sourceAuth.close()}
    const sourceBefore=await fullRows(db)
    const effective=JSON.parse(JSON.stringify(await db`select * from effective_attendance order by id`))
    const models: any={}
    for(const id of [legacy.id,old.id,active.id]) models[id]=JSON.parse(JSON.stringify(await getAttendanceReport(db,{teacherId:teacher.id,semesterId:id,mode:'semester'})))
    const backup=await createBackup(source)
    assert.deepEqual(await fullRows(db),sourceBefore,'backup never modifies source rows')
    const root=path.join(paths.backups,backup.id)
    const loaded=await validatePackage(root)
    assert.equal(loaded.manifest.assets.length,2)
    assert.equal(loaded.manifest.archived[0].asset_id,a.id)
    assert.equal(loaded.manifest.active[0].asset_id,b.id)
    const manifestText=loaded.raw.toString(); assert.ok(!manifestText.includes(teacher.email));assert.ok(!manifestText.includes('$scrypt$'))
    let compared=false,reset=false
    const restored=await restoreTest({id:backup.id,source,observe:async (step: any)=>{
      if(step.phase==='before-reset') {
        assert.deepEqual(await fullRows(step.db),sourceBefore)
        assert.deepEqual(JSON.parse(JSON.stringify(await step.db`select * from effective_attendance order by id`)),effective)
        for(const id of [legacy.id,old.id,active.id]) assert.deepEqual(JSON.parse(JSON.stringify(await getAttendanceReport(step.db,{teacherId:teacher.id,semesterId:id,mode:'semester'}))),models[id])
        assert.ok((await new LocalSchoolLogoStorage(step.logos).read(a.id,'image/png')).equals(a.bytes))
        assert.ok((await new LocalSchoolLogoStorage(step.logos).read(b.id,'image/jpeg')).equals(b.bytes))
        for(const sql of ['update audit_events set event_type=event_type','update semester_archive_snapshots set school_name=school_name','update school_logo_assets set width=width']) await assert.rejects(()=>step.db.unsafe(sql),'immutable USER guards restored')
        const runtime=connect(await clusterConnection(step.capability,'runtime'))
        try {
          await assert.rejects(()=>runtime`update audit_events set event_type=event_type`)
          const [roles]=await runtime`select pg_has_role(current_user,'pg_read_all_settings','member') as allowed`;assert.equal(roles.allowed,false)
        }finally{await runtime.end({timeout:3})}
        compared=true
      } else {
        const auth=await findTeacherAuthenticationByEmail(step.db,teacher.email)
        assert.ok(auth?.passwordHash)
        assert.equal(await hasher.verify(auth.passwordHash,'synthetic-password-only-123'),false)
        assert.equal(await hasher.verify(auth.passwordHash,step.password),true)
        assert.equal(await findTeacherSession(step.db,teacher.id,sessionId),null,'old cookie session identity no longer authenticates')
        assert.equal(auth.sessionVersion,2)
        const after=await fullRows(step.db)
        const originalIds=new Set(sourceBefore.audit_events.map((r: any)=>JSON.parse(r.row).id))
        assert.deepEqual(after.audit_events.filter((r: any)=>originalIds.has(JSON.parse(r.row).id)),sourceBefore.audit_events)
        const http=await authHarness(step.db,oldSeal)
        try {
          assert.equal((await fetch(http.url,{headers:{cookie:oldCookie},signal:AbortSignal.timeout(5000)})).status,401,'old sealed cookie fails even with same seal in fixture harness')
          const login=async(password:string)=>fetch(`${http.url}/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:teacher.email,password}),signal:AbortSignal.timeout(5000)})
          assert.equal((await login('synthetic-password-only-123')).status,401)
          const fresh=await login(step.password);assert.equal(fresh.status,200)
          const cookie=fresh.headers.get('set-cookie')?.split(';')[0]??''
          assert.equal((await fetch(http.url,{headers:{cookie},signal:AbortSignal.timeout(5000)})).status,200)
        } finally {await http.close()}
        reset=true
      }
    }})
    assert.ok(restored.compared&&restored.reset&&compared&&reset)
    assert.deepEqual(await fullRows(db),sourceBefore)
    assert.equal(sha256(await readFile(path.join(APP_ROOT,'scripts/cloud-data-transfer-core.mjs'))),cloudHash)
    console.log(`Roundtrip: 12 tables, ${sourceBefore.audit_events.length} original audit rows, 2 logo hashes; source unchanged; target cleaned.`)

    await t.test('corrupt manifest/dump/logo, descriptors and duplicate JSON fail without source change',async()=>{
      const originalManifest=await readFile(path.join(root,'manifest.json'))
      const originalSidecar=await readFile(path.join(root,'manifest.sha256'))
      const saveManifest=async(raw:Buffer)=>{await writeFile(path.join(root,'manifest.json'),raw);await writeFile(path.join(root,'manifest.sha256'),sha256(raw)+'\n')}
      try {
        await writeFile(path.join(root,'manifest.sha256'),'0'.repeat(64)+'\n');await assert.rejects(()=>restoreTest({id:backup.id,source}));await writeFile(path.join(root,'manifest.sha256'),originalSidecar)
        for(const mutate of [(m:any)=>{m.formatVersion=99},(m:any)=>{m.migrations[7].checksum='0'.repeat(64)},(m:any)=>{m.assets[0].path='../escape.png'},(m:any)=>{m.assets.push(m.assets[0])},(m:any)=>{m.unexpected=true}]) {
          const m=JSON.parse(originalManifest.toString());mutate(m);await saveManifest(Buffer.from(JSON.stringify(m)));await assert.rejects(()=>restoreTest({id:backup.id,source}))
        }
        await saveManifest(Buffer.from(originalManifest.toString().replace('"formatVersion":1','"formatVersion":1,"formatVersion":1')));await assert.rejects(()=>restoreTest({id:backup.id,source}))
        await saveManifest(originalManifest)
        const assetPath=path.join(root,loaded.manifest.assets[0].path), bytes=await readFile(assetPath)
        await writeFile(assetPath,Buffer.alloc(bytes.length));await assert.rejects(()=>restoreTest({id:backup.id,source}));await writeFile(assetPath,bytes)
        const dumpPath=path.join(root,'database.dump'), dump=await readFile(dumpPath)
        await writeFile(dumpPath,dump.subarray(0,20));await assert.rejects(()=>restoreTest({id:backup.id,source}));await writeFile(dumpPath,dump)
        await writeFile(path.join(root,'extra.txt'),'synthetic');await assert.rejects(()=>restoreTest({id:backup.id,source}));await unlink(path.join(root,'extra.txt'))
        assert.deepEqual(await fullRows(db),sourceBefore)
      } finally {await writeFile(path.join(root,'manifest.json'),originalManifest);await writeFile(path.join(root,'manifest.sha256'),originalSidecar)}
    })

    await t.test('trigger-only timezone invariant rolls back all imported rows; guards remain enabled',async()=>{
      const target=await newCluster(); const targetDb=connect(await clusterConnection(target))
      try {
        await runMigrations(targetDb)
        const schema=await schemaDescriptor(targetDb)
        const archivePath=path.join(root,'database.dump')
        const sql=await pgTool('pg_restore',['--data-only','--no-owner','--no-acl','--file=-',archivePath],{max:256*1024**2})
        const parsed=parseDump(sql,schema)
        parsed.blocks.schools.data[0]=parsed.blocks.schools.data[0].replace('Asia/Jakarta','Not/ARealZone')
        const conn=connectionArgs(await clusterConnection(target))
        await assert.rejects(()=>pgTool('psql',['--no-psqlrc','--set=ON_ERROR_STOP=1',...conn.args],{env:conn.env,input:buildRestoreSql(parsed,schema)}))
        const [empty]=await targetDb`select count(*)::int as n from teacher_accounts`;assert.equal(empty.n,0)
        const [guards]=await targetDb`select count(*)::int as n from pg_trigger where not tgisinternal and tgenabled<>'O'`;assert.equal(guards.n,0)
      }finally{await targetDb.end({timeout:3});await destroyCluster(target)}
    })

    await t.test('atomic failure and missing immutable logo produce no final package and keep previous package',async()=>{
      const finals=await readdir(paths.backups)
      await assert.rejects(()=>createBackup(source,{beforePublish:async()=>{throw new Error('synthetic interruption')}}))
      assert.deepEqual(await readdir(paths.backups),finals)
      const sourceAsset=path.join(paths.logos,`${b.id}.jpg`), held=sourceAsset+'.held'
      await rename(sourceAsset,held)
      try{await assert.rejects(()=>createBackup(source));assert.deepEqual(await readdir(paths.backups),finals)}finally{await rename(held,sourceAsset)}
      assert.deepEqual(await fullRows(db),sourceBefore)
    })

    await t.test('publication collision and changed cleanup ownership never delete foreign sentinel',async()=>{
      const outer=await ownedDirectory(TEST_ROOT,'publication')
      const receipt=await ownedDirectory(outer.path,'collision')
      const id='backup-20261022T010203Z-12345678-1234-4123-8123-123456789012'
      await writePrivate(path.join(receipt.path,'sentinel'),'synthetic-existing')
      const final=await publish(receipt,id)
      const next=await ownedDirectory(outer.path,'collision')
      try{await assert.rejects(()=>publish(next,id));assert.equal((await readFile(path.join(final,'sentinel'))).toString(),'synthetic-existing')}finally{await cleanup(next)}
      // Preserve the published sentinel: publication transfers ownership out of the receipt.
      await assert.rejects(()=>verifyOwned(receipt))
      await cleanup(outer)
    })

    await t.test('ACL verifier refuses extra principal and receipt refuses swapped directory',async()=>{
      const owned=await ownedDirectory(TEST_ROOT,'ownership')
      try {
        execFileSync('icacls.exe',[owned.path,'/grant','*S-1-1-0:(OI)(CI)R'],{stdio:'ignore',windowsHide:true})
        assert.throws(()=>privateAcl(owned.path),/ACL-verification/)
        execFileSync('icacls.exe',[owned.path,'/remove:g','*S-1-1-0'],{stdio:'ignore',windowsHide:true})
        privateAcl(owned.path)
        const held=owned.path+'.held'
        await rename(owned.path,held)
        const {mkdir,rmdir}=await import('node:fs/promises')
        await mkdir(owned.path);await writeFile(path.join(owned.path,'sentinel'),'replacement-synthetic')
        await assert.rejects(()=>cleanup(owned),/ownership-changed/)
        assert.equal((await readFile(path.join(owned.path,'sentinel'))).toString(),'replacement-synthetic')
        await unlink(path.join(owned.path,'sentinel'));await rmdir(owned.path);await rename(held,owned.path)
      }finally{await cleanup(owned)}
    })

    await t.test('occupied startup port is rejected without attaching or stopping its foreign listener',async()=>{
      const listener=net.createServer()
      try {
        await assert.rejects(()=>newCluster({beforeStart:async({port}:any)=>{await new Promise<void>((resolve,reject)=>{listener.once('error',reject);listener.listen(port,'127.0.0.1',resolve)})}}))
        assert.equal(listener.listening,true)
      }finally{if(listener.listening)await new Promise<void>((resolve,reject)=>listener.close(e=>e?reject(e):resolve()))}
    })

    await t.test('shared snapshot stays before concurrent logo change and semester closure; next backup sees commit',async()=>{
      const snapshotBefore=await fullRows(db)
      const during=await createBackup(source,{afterSnapshot:async()=>{
        await actor((tx:any)=>setActiveSchoolLogo(tx,{schoolId:school.id,assetId:a.id}))
        await close(active.id)
      }})
      const afterWriter=await fullRows(db);assert.notDeepEqual(afterWriter,snapshotBefore)
      await restoreTest({id:during.id,source,observe:async(step:any)=>{if(step.phase==='before-reset')assert.deepEqual(await fullRows(step.db),snapshotBefore)}})
      const later=await createBackup(source)
      await restoreTest({id:later.id,source,observe:async(step:any)=>{if(step.phase==='before-reset')assert.deepEqual(await fullRows(step.db),afterWriter)}})
      assert.deepEqual(await fullRows(db),afterWriter)
    })
  } finally { await db.end({timeout:3}); await destroyCluster(cap) }
})
