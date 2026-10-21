import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, link, symlink, unlink, rm, realpath } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments } from '../scripts/local-backup.mjs'
import { strictJson, APP_ROOT, TEST_ROOT, readPrivate, safeTree } from '../scripts/local-backup-files.mjs'
import { parseDump, TABLES } from '../scripts/local-backup-core.mjs'
import { childEnvironment, runChild, verifyCluster, connectionArgs } from '../scripts/local-backup-postgres.mjs'

const schema=Object.fromEntries(TABLES.map((name)=>[name,[{column_name:'id',type:'uuid',required:true,identity:'',generated:''}]]))
const syntheticSql=()=>Buffer.from(TABLES.map((name)=>`COPY public.${name} (id) FROM stdin;\n\\.\n`).join('')+"SELECT pg_catalog.setval('public.audit_events_id_seq', 1, false);\n")

test('CLI rejects URL/path/force/duplicate/unknown flags before any database or file operation',()=>{
  assert.deepEqual(parseArguments(['create']),{command:'create'})
  const id='backup-20261022T010203Z-12345678-1234-4123-8123-123456789012'
  assert.deepEqual(parseArguments(['restore-test',`--backup=${id}`]),{command:'restore-test',id})
  for(const args of [[],['create','--force'],['create','--source=postgres://127.0.0.1:55432'],['restore-test',`--backup=${id}`,'--target=postgres://remote'],['restore-test','--backup=../x'],['restore-test',`--backup=${id}`,`--backup=${id}`],['restore-test','--backup=C:\\x'],['restore-test','--backup=\\\\server\\x']]) assert.throws(()=>parseArguments(args))
})

test('duplicate JSON keys including escaped aliases are rejected at every object depth',()=>{
  for(const value of ['{"id":1,"id":2}','{"a":{"id":1,"\\u0069d":2}}','[{"id":1,"id":1}]','{"a":1} garbage','{"a":1,}','[1,]']) assert.throws(()=>strictJson(Buffer.from(value)))
  assert.deepEqual(strictJson(Buffer.from('{"list":[null,true,false,1.2e2,{"label":"quote\\\"x"}]}')),{list:[null,true,false,120,{label:'quote"x'}]})
})

test('archive parser accepts exactly typed COPY sections and refuses executable SQL, psql escapes, duplicates and partial input',()=>{
  assert.equal(Object.keys(parseDump(syntheticSql(),schema).blocks).length,12)
  for(const sql of [
    Buffer.concat([syntheticSql(),Buffer.from('SELECT pg_sleep(30);\n')]),
    Buffer.concat([syntheticSql(),Buffer.from('\\! whoami\n')]),
    Buffer.concat([syntheticSql(),Buffer.from("COPY public.schools FROM PROGRAM 'calc';\n")]),
    Buffer.from(syntheticSql().toString().replace('COPY public.schools (id)','COPY public.schools (id,id)')),
    Buffer.from(syntheticSql().toString().replace('COPY public.schools (id)','COPY public.unknown_table (id)')),
    Buffer.from(syntheticSql().toString().replace('COPY public.schools (id) FROM stdin;\n\\.\n','')),
    Buffer.concat([syntheticSql(),Buffer.from('COPY public.schools (id) FROM stdin;\n\\.\n')]),
    Buffer.from('COPY public.schools (id) FROM stdin;\nnot-terminated'),
    Buffer.concat([syntheticSql(),Buffer.from("SET statement_timeout = pg_sleep(30);\n")]),
    Buffer.from(syntheticSql().toString().replace("1, false);","9223372036854775807, false);")),
    Buffer.from(syntheticSql().toString().replace('COPY public.schools (id) FROM stdin;\n\\.','COPY public.schools (id) FROM stdin;\n\\connect remote\n\\.')),
  ]) assert.throws(()=>parseDump(sql,schema))
})

test('capability and child connection overrides cannot select an existing target',async()=>{
  await assert.rejects(()=>verifyCluster({migrationUrl:'postgres://127.0.0.1:55432/lab002_local'}))
  await assert.rejects(()=>verifyCluster(Object.freeze({})))
  for(const uri of ['postgres://x:y@remote:5432/db?sslmode=disable','postgres://x:y@127.0.0.1:5432/db?sslmode=disable&options=unsafe','postgres://x:y@[::1]:5432/db?sslmode=disable']) assert.throws(()=>connectionArgs(uri))
  const previous=process.env.PGHOST; process.env.PGHOST='synthetic-foreign-host'
  try { assert.equal(childEnvironment().PGHOST,undefined) } finally { if(previous===undefined) delete process.env.PGHOST; else process.env.PGHOST=previous }
  const previousOptions=process.env.pgoptions;process.env.pgoptions='synthetic-override'
  try{assert.equal(Object.keys(childEnvironment()).some(key=>key.toLowerCase()==='pgoptions'),false)}finally{if(previousOptions===undefined)delete process.env.pgoptions;else process.env.pgoptions=previousOptions}
})

test('child timeout and output bound terminate only the owned child handle',async()=>{
  const start=Date.now()
  await assert.rejects(()=>runChild(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:80}),/timeout/)
  assert.ok(Date.now()-start<5000)
  await assert.rejects(()=>runChild(process.execPath,['-e',"process.stdout.write('x'.repeat(10000))"],{max:10}),/output limit/)
  assert.equal((await runChild(process.execPath,['-e',"process.stdout.write('alive')"])).toString(),'alive')
})

test('regular file reads reject hardlink, file symlink and directory junction without changing foreign sentinels',async()=>{
  // This directory contains only the literal synthetic string below; no ACL helper or database is invoked.
  await mkdir(TEST_ROOT,{recursive:true})
  const root=await mkdtemp(path.join(TEST_ROOT,'validation-'))
  const sentinel=path.join(root,'sentinel.txt')
  const hard=path.join(root,'hard.txt'), soft=path.join(root,'soft.txt'), junction=path.join(root,'junction')
  await writeFile(sentinel,'synthetic-sentinel')
  try {
    assert.equal((await readPrivate(sentinel,100)).toString(),'synthetic-sentinel')
    await link(sentinel,hard); await assert.rejects(()=>readPrivate(hard,100)); await unlink(hard)
    await symlink(sentinel,soft,'file'); await assert.rejects(()=>readPrivate(soft,100)); await unlink(soft)
    await symlink(root,junction,'junction'); await assert.rejects(()=>readPrivate(path.join(junction,'sentinel.txt'),100)); await unlink(junction)
    await assert.rejects(()=>readPrivate(sentinel,2))
    assert.equal((await readPrivate(sentinel,100)).toString(),'synthetic-sentinel')
  } finally {
    for(const linkPath of [hard,soft,junction]) await unlink(linkPath).catch((e)=>{if(e.code!=='ENOENT')throw e})
    assert.equal(path.dirname(await realpath(root)),await realpath(TEST_ROOT))
    await safeTree(root); await rm(root,{recursive:true,force:false})
  }
})
