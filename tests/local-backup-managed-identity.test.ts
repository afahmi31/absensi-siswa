import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { windowsArguments, parsePostmaster, validateIdentitySnapshot, beginManagedIdentity, verifyManagedIdentity, readTrustedBinary, assertSameIdentity } from '../scripts/local-backup-managed-identity.mjs'
import { newCluster, verifyCluster, clusterConnection, connect, destroyCluster, PG_BIN } from '../scripts/local-backup-postgres.mjs'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { fixtureSource, fixturePaths, createBackup, restoreTest } from '../scripts/local-backup-core.mjs'

const expected={root:'D:\\synthetic root\\pg',port:55432,database:'lab002_local',role:'lab002_migrator'}
const mainExe=path.join(PG_BIN,'postgres.exe')
function snapshot():any {
  return {
    files:{version:'16',root:{dev:1,ino:2},pid:{pid:100,root:expected.root,epoch:1792616132,port:55432},pidIdentity:{dev:1,ino:3},pidHash:'a'.repeat(64),binaries:[]},statusPid:100,
    sql:{database:'lab002_local',role:'lab002_migrator',session_role:'lab002_migrator',read_only:'on',owner:'lab002_migrator',host:'127.0.0.1',client_host:'127.0.0.1',port:55432,client_port:54321,version:160013,backend:200,started:'1792616132.698365'},
    os:{processes:[{pid:100,parent:50,exe:mainExe,command:`"${mainExe}" -D "${expected.root}"`,created:'2026-10-21T20:55:32.6085860Z'},{pid:200,parent:100,exe:mainExe,command:`"${mainExe}" "--forkbackend" "5532"`,created:'2026-10-21T20:55:33.3661620Z'}],sockets:[{local:'127.0.0.1',port:55432,remote:'0.0.0.0',remotePort:0,state:'Listen',owner:100},{local:'127.0.0.1',port:55432,remote:'127.0.0.1',remotePort:54321,state:'Established',owner:100}]},
  }
}

test('Windows argument tokenizer and PID parser reject ambiguous/partial/duplicate foreign root descriptions',()=>{
  assert.deepEqual(windowsArguments('"C:\\Program Files\\pg.exe" -D "D:\\path with space\\pg"'),['C:\\Program Files\\pg.exe','-D','D:\\path with space\\pg'])
  for(const command of [' "pg.exe" -D x','"unterminated','pg.exe -D ""','pg.exe\n-D x'])assert.throws(()=>windowsArguments(command))
  const pid=Buffer.from(`100\n${expected.root}\n1792616132\n55432\n\n127.0.0.1\n0 0\nready   \n`)
  assert.equal(parsePostmaster(pid,expected).pid,100)
  for(const value of [pid.toString().replace('100\n','0\n'),pid.toString().replace('55432','5432'),pid.toString().replace(expected.root,expected.root+'-foreign'),pid.toString().replace('ready','starting'),pid.toString()+'extra\n'])assert.throws(()=>parsePostmaster(Buffer.from(value),expected))
})

test('composite identity refuses foreign/missing/ambiguous components and does not equate listener with SQL backend',()=>{
  assert.equal(validateIdentitySnapshot(snapshot(),expected).main.pid,100)
  const cases=[
    (s:any)=>{s.os.processes[0].exe='C:\\foreign\\postgres.exe'},(s:any)=>{s.os.processes[0].exe=null},
    (s:any)=>{s.os.processes[0].command+=` -D "${expected.root}"`},(s:any)=>{s.os.processes[0].command+=' -c data_directory=D:\\foreign'},
    (s:any)=>{s.os.processes[0].command=s.os.processes[0].command.replace(expected.root,expected.root+'-foreign')},
    (s:any)=>{s.os.processes[1].parent=999},(s:any)=>{s.os.processes[1].created='2026-10-20T20:55:33.3661620Z'},
    (s:any)=>{s.os.processes[0].created='2026-10-22T20:55:33.3661620Z'},(s:any)=>{s.os.processes.pop()},
    (s:any)=>{s.os.sockets[0].owner=999},(s:any)=>{s.os.sockets[0].local='0.0.0.0'},(s:any)=>{s.os.sockets.push({...s.os.sockets[0]})},
    (s:any)=>{s.os.sockets[1].remotePort=54322},(s:any)=>{s.os.sockets[1].owner=200},(s:any)=>{s.os.sockets.splice(1)},
    (s:any)=>{s.sql.started='1792616131.698365'},(s:any)=>{s.sql.role='lab002_app'},(s:any)=>{s.sql.session_role='other'},(s:any)=>{s.sql.read_only='off'},
    (s:any)=>{s.sql.database='foreign'},(s:any)=>{s.sql.host='remote'},(s:any)=>{s.sql.client_host='192.0.2.1'},
    (s:any)=>{s.statusPid=999},(s:any)=>{s.files.version='18'},(s:any)=>{s.files.pid.root='D:\\foreign'},
    (s:any)=>{s.os=null},(s:any)=>{s.os.sockets=null},
  ]
  for(const mutate of cases){const value=snapshot();mutate(value);assert.throws(()=>validateIdentitySnapshot(value,expected))}
  const baseline=validateIdentitySnapshot(snapshot(),expected),reused=snapshot()
  reused.os.processes[0].created='2026-10-21T20:55:31.6085860Z'
  assert.throws(()=>assertSameIdentity(baseline,validateIdentitySnapshot(reused,expected)))
})

test('PG16 startup chronology accepts same/crossing second and pins each timestamp exactly',()=>{
  const same=snapshot();assert.ok(validateIdentitySnapshot(same,expected))
  const crossing=snapshot();crossing.sql.started='1792616133.001000';assert.ok(validateIdentitySnapshot(crossing,expected))
  assert.throws(()=>assertSameIdentity(validateIdentitySnapshot(same,expected),validateIdentitySnapshot(crossing,expected)))
  const futurePid=snapshot();futurePid.files.pid.epoch=1792616133;assert.throws(()=>validateIdentitySnapshot(futurePid,expected))
  const reversedCreation=snapshot();reversedCreation.os.processes[0].created='2026-10-21T20:55:33.1000000Z';assert.throws(()=>validateIdentitySnapshot(reversedCreation,expected))
  const futureSQL=snapshot();futureSQL.sql.started='1792616132.100000';assert.throws(()=>validateIdentitySnapshot(futureSQL,expected))
  const afterBackend=snapshot();afterBackend.sql.started='1792616134.001000';assert.throws(()=>validateIdentitySnapshot(afterBackend,expected))
  const subMillisecond=snapshot();subMillisecond.os.processes[0].created='2026-10-21T20:55:32.6983651Z';assert.throws(()=>validateIdentitySnapshot(subMillisecond,expected))
})

test('fixed trusted Windows binary allows observed servicing link but pins file identity/nlink/hash',async()=>{
  const binary=await readTrustedBinary('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  assert.ok([1,2].includes(binary.nlink));assert.match(binary.hash,/^[a-f0-9]{64}$/)
  assertSameIdentity(binary,{...binary})
  for(const delta of [{nlink:3},{ino:binary.ino+1},{size:binary.size+1},{hash:'0'.repeat(64)}])assert.throws(()=>assertSameIdentity(binary,{...binary,...delta}))
  await assert.rejects(()=>readTrustedBinary('D:\\arbitrary\\powershell.exe'))
})

test('real Windows nonprivileged retained session identity; stale PID mutation refused and exporter disconnect fails', {timeout:120000},async()=>{
  const cap=await newCluster();const state=await verifyCluster(cap)
  const db=connect(await clusterConnection(cap,'runtime'))
  const policy={root:state.dataDirectory,port:state.port,database:'lab002_test',role:'lab002_app',owner:'lab002_migrator',fixtureConfig:path.join(state.dataDirectory,'backup-config.conf')}
  try{
    await db.begin('read only',async tx=>{
      const [role]=await tx`select pg_has_role(current_user,'pg_read_all_settings','member') as allowed`;assert.equal(role.allowed,false)
      const receipt=await beginManagedIdentity(tx,policy)
      await verifyManagedIdentity(receipt,tx)
      const pidPath=path.join(state.dataDirectory,'postmaster.pid'),original=await readFile(pidPath)
      try{await writeFile(pidPath,original.toString().replace(`${state.pid}\n`,'999999\n'));await assert.rejects(()=>verifyManagedIdentity(receipt,tx))}finally{await writeFile(pidPath,original)}
      await verifyManagedIdentity(receipt,tx)
      await assert.rejects(()=>verifyManagedIdentity({},tx))
    })
    let receipt:any,closedTx:any
    await db.begin('read only',async tx=>{closedTx=tx;receipt=await beginManagedIdentity(tx,policy)})
    await db.end({timeout:3})
    await assert.rejects(()=>verifyManagedIdentity(receipt,closedTx))
  }finally{await db.end({timeout:3});await destroyCluster(cap)}
})

test('guarded synthetic create keeps exporter identity through dump and publication; failure preserves source/package', {timeout:180000},async()=>{
  const cap=await newCluster();const db=connect(await clusterConnection(cap))
  try{
    await runMigrations(db)
    await provisionTeacherAccount(db,'identity-only@example.invalid',await new Scrypt({}).make('synthetic-password-never-used'))
    const source=await fixtureSource(cap,{identityGuard:true}),paths=await fixturePaths(source)
    const [before]=await db`select row_to_json(t)::text as row from teacher_accounts t`
    const result=await createBackup(source)
    assert.equal(result.tables,12)
    await restoreTest({id:result.id,source})
    const finals=await readdir(paths.backups)
    const state=await verifyCluster(cap),pidPath=path.join(state.dataDirectory,'postmaster.pid'),original=await readFile(pidPath)
    try{
      await assert.rejects(()=>createBackup(source,{beforePublish:async()=>{await writeFile(pidPath,original.toString().replace(`${state.pid}\n`,'999999\n'))}}))
    }finally{await writeFile(pidPath,original)}
    assert.deepEqual(await readdir(paths.backups),finals)
    await assert.rejects(()=>createBackup(source,{afterSnapshot:async()=>{
      const backends=await db`select pid from pg_stat_activity where datname=current_database() and usename=current_user and pid<>pg_backend_pid() and state='idle in transaction'`
      assert.equal(backends.length,1,'terminate only this fixture exporter, never a managed/foreign process')
      await db`select pg_terminate_backend(${backends[0].pid})`
    }}), /exporter-disconnected/)
    assert.deepEqual(await readdir(paths.backups),finals)
    const [remaining]=await db`select count(*)::int as count from pg_stat_activity where datname=current_database() and usename=current_user and pid<>pg_backend_pid() and backend_type='client backend'`
    assert.equal(remaining.count,0,'failed create leaves no owned exporter backend')
    const [after]=await db`select row_to_json(t)::text as row from teacher_accounts t`;assert.equal(after.row,before.row)
  }finally{await db.end({timeout:3});await destroyCluster(cap)}
})
