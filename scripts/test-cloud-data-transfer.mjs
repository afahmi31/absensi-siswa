import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postgres from 'postgres'
import { closeSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { setRoutineSchoolDay } from '../server/database/repositories/calendar.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { addDays, createSchoolFixture, recordAttendance } from '../tests/fixtures/school-fixture.ts'
import { startTemporaryPostgres } from '../tests/support/temporary-postgres.mjs'
import { runMigrations } from '../server/database/migrate.mjs'
import {
  EXCLUDED_TABLES,
  TRANSFER_TABLES,
  buildManifest,
  buildRestoreSql,
  createCustomArchive,
  generatedSnapshotName,
  inspectSourceDatabase,
  inspectTargetDatabase,
  loadManifest,
  readRestoreSqlFromArchive,
  runPsqlRestore,
  validateCloudTargetUrl,
} from './cloud-data-transfer-core.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const artifactParent = path.join(dataRoot, 'cloud-transfer', 'rehearsal')
const pgBinDirectory = 'C:\\Program Files\\PostgreSQL\\16\\bin'
const sourceBaselineMigrationNames = [
  '0001_core',
  '0002_authentication',
  '0003_semester_archive_snapshots',
  '0004_attendance_manual_clear',
]

function protectDirectory(directory) {
  const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const sid = identity.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) throw new Error('Could not secure the synthetic rehearsal artifacts.')
  execFileSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], {
    stdio: 'ignore',
    windowsHide: true,
  })
}

function mutateCopyColumn(sql, table, column, value) {
  const lines = sql.split(/\r?\n/)
  const headerPattern = new RegExp(`^COPY public\\.${table} \\(([^)]*)\\) FROM stdin;$`)
  const headerIndex = lines.findIndex((line) => headerPattern.test(line))
  assert.notEqual(headerIndex, -1)
  const header = lines[headerIndex].match(headerPattern)
  const columns = header[1].split(',').map((name) => name.trim().replace(/^"|"$/g, ''))
  const columnIndex = columns.indexOf(column)
  assert.notEqual(columnIndex, -1)
  const dataIndex = headerIndex + 1
  assert.ok(lines[dataIndex] && lines[dataIndex] !== '\\.')
  const fields = lines[dataIndex].split('\t')
  fields[columnIndex] = value
  lines[dataIndex] = fields.join('\t')
  return lines.join('\n')
}

async function fullRowDigest(database, table) {
  assert.ok(TRANSFER_TABLES.includes(table))
  const [result] = await database.unsafe(`
    select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\\n' order by to_jsonb(row_value)::text), '')) as digest
    from public."${table}" as row_value
  `)
  return result.digest
}

async function count(database, table, schema = 'public') {
  assert.ok(/^(public|private)$/.test(schema))
  assert.ok(/^[a-z_][a-z0-9_]*$/.test(table))
  const [result] = await database.unsafe(`select count(*)::int as count from ${schema}."${table}"`)
  return Number(result.count)
}

async function assertPublicTriggersEnabled(database) {
  const tableNames = [...TRANSFER_TABLES, 'teacher_sessions', 'schema_migrations']
  const rows = await database`
    select count(*)::int as disabled
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as table_class on table_class.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname = any(${database.array(tableNames)})
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'O'
  `
  assert.equal(Number(rows[0].disabled), 0)
}

async function assertTargetEmpty(database) {
  for (const table of [...TRANSFER_TABLES, 'teacher_sessions']) assert.equal(await count(database, table), 0)
  assert.equal(await count(database, 'login_throttle_attempts', 'private'), 0)
}

async function assertForeignKeysValidated(database) {
  const [result] = await database`
    select count(*)::int as count
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as table_class on table_class.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where constraint_row.contype = 'f'
      and table_schema.nspname in ('public', 'private')
      and not constraint_row.convalidated
  `
  assert.equal(Number(result.count), 0)
}

async function cleanupArtifactRun(runDirectory, archiveName, manifestName) {
  const root = path.resolve(runDirectory)
  const expectedParent = await realpath(artifactParent)
  if (path.dirname(root) !== expectedParent || !/^run-[0-9a-f-]{36}$/.test(path.basename(root))) {
    throw new Error('Refusing to clean a rehearsal directory outside its generated artifact path.')
  }
  const restoreDirectory = path.join(root, 'rehearsal')
  const restoreParent = await realpath(restoreDirectory).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (restoreParent === restoreDirectory) {
    for (const name of await readdir(restoreDirectory)) {
      if (!/^restore-[0-9a-f-]{36}\.sql$/.test(name)) throw new Error('Unexpected file found in the generated rehearsal directory.')
      await unlink(path.join(restoreDirectory, name))
    }
    await rmdir(restoreDirectory)
  }
  const baselineRoot = path.join(root, 'source-baseline-runner')
  const baselineMigrations = path.join(baselineRoot, 'migrations')
  const resolvedBaselineRoot = await realpath(baselineRoot).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (resolvedBaselineRoot !== null) {
    if (path.dirname(resolvedBaselineRoot) !== root || path.basename(resolvedBaselineRoot) !== 'source-baseline-runner') {
      throw new Error('Refusing to clean an unexpected source baseline runner path.')
    }
    const expectedMigrationFiles = sourceBaselineMigrationNames.flatMap((name) => [`${name}.up.sql`, `${name}.down.sql`]).sort()
    const resolvedMigrations = await realpath(baselineMigrations).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    if (resolvedMigrations !== null) {
      if (path.dirname(resolvedMigrations) !== resolvedBaselineRoot || path.basename(resolvedMigrations) !== 'migrations') {
        throw new Error('Refusing to clean an unexpected copied source migration path.')
      }
      const migrationFiles = await readdir(baselineMigrations)
      if (migrationFiles.some((name) => !expectedMigrationFiles.includes(name))) {
        throw new Error('Unexpected file found in the copied source baseline migration directory.')
      }
      for (const name of migrationFiles) await unlink(path.join(baselineMigrations, name))
      await rmdir(baselineMigrations)
    }
    await unlink(path.join(baselineRoot, 'migrate.mjs')).catch((error) => { if (error?.code !== 'ENOENT') throw error })
    await rmdir(baselineRoot)
  }
  for (const name of [archiveName, manifestName]) {
    if (!/^(snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump|snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json)$/.test(name)) {
      throw new Error('Refusing to clean a file outside the generated snapshot naming pattern.')
    }
    await unlink(path.join(root, name)).catch((error) => { if (error?.code !== 'ENOENT') throw error })
  }
  await rmdir(root)
}

async function createLegacySourceMigrationRunner(runDirectory) {
  const baselineRoot = path.join(runDirectory, 'source-baseline-runner')
  const baselineMigrations = path.join(baselineRoot, 'migrations')
  await mkdir(baselineMigrations, { recursive: true })
  protectDirectory(baselineRoot)
  protectDirectory(baselineMigrations)
  const sourceMigrationDirectory = path.join(appRoot, 'server', 'database', 'migrations')
  await writeFile(
    path.join(baselineRoot, 'migrate.mjs'),
    await readFile(path.join(appRoot, 'server', 'database', 'migrate.mjs'), 'utf8'),
    { flag: 'wx', mode: 0o600 },
  )
  for (const name of sourceBaselineMigrationNames) {
    for (const direction of ['up', 'down']) {
      const filename = `${name}.${direction}.sql`
      await writeFile(
        path.join(baselineMigrations, filename),
        await readFile(path.join(sourceMigrationDirectory, filename), 'utf8'),
        { flag: 'wx', mode: 0o600 },
      )
    }
  }
  const runner = await import(pathToFileURL(path.join(baselineRoot, 'migrate.mjs')).href)
  return runner.runMigrations
}

if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24) {
  throw new Error('Synthetic transfer rehearsal requires Windows and the project Node.js 24 runtime.')
}

let sourceTemporary
let targetTemporary
let legacySourceTemporary
let upgradeTargetTemporary
let source
let target
let sourceDatabase
let targetDatabase
let legacySourceDatabase
let upgradeTargetDatabase
let runDirectory
let archiveName
let manifestName
let upgradeRunDirectory
let upgradeArchiveName
let upgradeManifestName
let stage = 'starting two isolated PostgreSQL clusters'

try {
  sourceTemporary = await startTemporaryPostgres()
  targetTemporary = await startTemporaryPostgres()
  await mkdir(artifactParent, { recursive: true })
  protectDirectory(path.join(dataRoot, 'cloud-transfer'))
  protectDirectory(artifactParent)
  runDirectory = path.join(artifactParent, `run-${randomUUID()}`)
  const restoreDirectory = path.join(runDirectory, 'rehearsal')
  await mkdir(runDirectory)
  protectDirectory(runDirectory)
  await mkdir(restoreDirectory)
  protectDirectory(restoreDirectory)

  sourceDatabase = postgres(sourceTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  targetDatabase = postgres(targetTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  stage = 'applying current migrations to the synthetic clusters'
  const sourceMigrations = await runMigrations(sourceDatabase, 'up')
  const targetMigrations = await runMigrations(targetDatabase, 'up')
  assert.equal(sourceMigrations.length, 6)
  assert.equal(targetMigrations.length, 6)

  stage = 'seeding the synthetic closed-semester, account, and audit fixture'
  const fixture = await createSchoolFixture(sourceDatabase)
  const fakePasswordHash = 'synthetic-transfer-hash-not-valid-for-login'
  await sourceDatabase`
    update public.teacher_accounts
    set password_hash = ${fakePasswordHash}, session_version = 7
    where id = ${fixture.teacherId}
  `
  await sourceDatabase`
    insert into public.teacher_sessions (id, teacher_id, session_version, expires_at)
    values (${randomUUID()}, ${fixture.teacherId}, 7, statement_timestamp() + interval '1 day')
  `
  await sourceDatabase`
    insert into private.login_throttle_attempts (key_hash, window_started_at, failure_count, expires_at)
    values (${'a'.repeat(64)}, statement_timestamp(), 1, statement_timestamp() + interval '1 day')
  `
  await sourceDatabase`
    insert into public.audit_events (actor_kind, entity_type, entity_id, event_type, new_value)
    values ('system', 'synthetic_transfer_probe', ${randomUUID()}, 'insert', '{"fixture":true}'::jsonb)
  `
  for (let weekday = 0; weekday < 7; weekday += 1) {
    await setRoutineSchoolDay(sourceDatabase, {
      schoolId: fixture.schoolId,
      dayOfWeek: weekday,
      effectiveFrom: addDays(fixture.today, -20),
      isSchoolDay: false,
    })
  }
  for (const date of [fixture.membershipStart, fixture.today]) {
    await recordAttendance(sourceDatabase, fixture.membershipOneId, fixture.semesterId, date)
    await recordAttendance(sourceDatabase, fixture.membershipTwoId, fixture.semesterId, date)
  }
  const preview = await getSemesterClosurePreview(sourceDatabase, { semesterId: fixture.semesterId, teacherId: fixture.teacherId })
  assert.ok(preview?.calendarConfigured)
  assert.equal(preview.incompleteSchoolDayCount, 0)
  await withAuditActor(sourceDatabase, fixture.teacherId, (transaction) => closeSemester(transaction, {
    semesterId: fixture.semesterId,
    teacherId: fixture.teacherId,
    previewToken: preview.previewToken,
    confirmed: true,
  }))
  assert.equal((await sourceDatabase`select status from public.semesters where id = ${fixture.semesterId}`)[0].status, 'closed')
  assert.ok(await count(sourceDatabase, 'semester_archive_snapshots') > 0)

  stage = 'creating the synthetic custom-format snapshot archive'
  const snapshot = generatedSnapshotName()
  archiveName = `${snapshot}.dump`
  manifestName = `${snapshot}.json`
  const archivePath = path.join(runDirectory, archiveName)
  const sourceMetadata = await inspectSourceDatabase(sourceDatabase, { synthetic: true })
  const backup = await createCustomArchive({
    sourceUrl: sourceTemporary.migrationUrl,
    destination: archivePath,
    artifactDirectory: runDirectory,
    pgBinDirectory,
    synthetic: true,
  })
  assert.ok(backup.archiveBytes > 0)
  stage = 'reading the synthetic archive through the private pg_restore file'
  const restoredSql = await readRestoreSqlFromArchive(archivePath, {
    privateDirectory: runDirectory,
    pgBinDirectory,
    rehearsal: true,
  })
  const manifest = await buildManifest({ archivePath, source: sourceMetadata, restoredSql })
  const manifestPath = path.join(runDirectory, manifestName)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  const loadedManifest = await loadManifest(manifestPath, runDirectory)
  assert.deepEqual(loadedManifest.manifest.targetMigrations, manifest.targetMigrations)
  assert.deepEqual(loadedManifest.manifest.sourceMigrations, manifest.sourceMigrations)
  assert.equal(manifest.transferredTables.length, 11)
  assert.deepEqual(manifest.excludedTables, EXCLUDED_TABLES)
  assert.equal(manifest.rowCounts.teacher_accounts, 1)
  assert.ok(manifest.rowCounts.audit_events > 0)

  assert.throws(() => validateCloudTargetUrl('postgres://lab002_migrator.wrongref:synthetic@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'))
  assert.throws(() => validateCloudTargetUrl('postgres://lab002_migrator.jkiewjlohgmsujcwerpi:synthetic@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=disable'))
  assert.deepEqual(await inspectTargetDatabase(targetDatabase, manifest, { kind: 'synthetic', synthetic: true }), {
    database: 'lab002_test',
    role: 'lab002_migrator',
    postgresMajor: 16,
    ready: true,
  })

  stage = 'checking atomic rollback on invalid synthetic attendance data'
  const invalidAttendanceDump = mutateCopyColumn(restoredSql, 'attendance_records', 'status', 'Z')
  const failedRestoreScript = buildRestoreSql(invalidAttendanceDump, manifest, { kind: 'synthetic' })
  await assert.rejects(runPsqlRestore({
    connectionUrl: targetTemporary.migrationUrl,
    script: failedRestoreScript,
    kind: 'synthetic',
    pgBinDirectory,
  }))
  await assertTargetEmpty(targetDatabase)
  await assertPublicTriggersEnabled(targetDatabase)
  await assertForeignKeysValidated(targetDatabase)
  await inspectTargetDatabase(targetDatabase, manifest, { kind: 'synthetic', synthetic: true })

  stage = 'importing the valid synthetic snapshot into the second cluster'
  const restoreScript = buildRestoreSql(restoredSql, manifest, { kind: 'synthetic' })
  await runPsqlRestore({
    connectionUrl: targetTemporary.migrationUrl,
    script: restoreScript,
    kind: 'synthetic',
    pgBinDirectory,
  })
  for (const table of TRANSFER_TABLES) {
    assert.equal(await fullRowDigest(sourceDatabase, table), await fullRowDigest(targetDatabase, table))
    assert.equal(await count(targetDatabase, table), manifest.rowCounts[table])
  }
  const [targetTeacher] = await targetDatabase`select password_hash, session_version from public.teacher_accounts where id = ${fixture.teacherId}`
  assert.equal(targetTeacher.password_hash, fakePasswordHash)
  assert.equal(targetTeacher.session_version, 7)
  assert.equal(await count(sourceDatabase, 'teacher_sessions'), 1)
  assert.equal(await count(targetDatabase, 'teacher_sessions'), 0)
  assert.equal(await count(sourceDatabase, 'login_throttle_attempts', 'private'), 1)
  assert.equal(await count(targetDatabase, 'login_throttle_attempts', 'private'), 0)

  const [sourceSequence] = await sourceDatabase`select last_value::text as last_value, is_called from public.audit_events_id_seq`
  const [targetSequence] = await targetDatabase`select last_value::text as last_value, is_called from public.audit_events_id_seq`
  const nextValue = BigInt(manifest.auditSequence.lastValue) + (manifest.auditSequence.isCalled ? BigInt(manifest.auditSequence.incrementBy) : 0n)
  assert.equal(targetSequence.last_value, nextValue.toString())
  assert.equal(targetSequence.is_called, false)
  assert.ok(BigInt(sourceSequence.last_value) >= BigInt(manifest.auditSequence.lastValue))
  await assertPublicTriggersEnabled(targetDatabase)
  await assertForeignKeysValidated(targetDatabase)
  await assert.rejects(
    inspectTargetDatabase(targetDatabase, manifest, { kind: 'synthetic', synthetic: true }),
    /Transfer target is not empty\./,
  )

  stage = 'preparing an exact four-migration source against the six-migration target'
  legacySourceTemporary = await startTemporaryPostgres()
  legacySourceDatabase = postgres(legacySourceTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  upgradeTargetTemporary = await startTemporaryPostgres()
  upgradeTargetDatabase = postgres(upgradeTargetTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  upgradeRunDirectory = path.join(artifactParent, `run-${randomUUID()}`)
  upgradeArchiveName = `${generatedSnapshotName()}.dump`
  upgradeManifestName = upgradeArchiveName.replace(/\.dump$/, '.json')
  await mkdir(upgradeRunDirectory)
  protectDirectory(upgradeRunDirectory)
  const runLegacyMigrations = await createLegacySourceMigrationRunner(upgradeRunDirectory)
  const legacySourceMigrations = await runLegacyMigrations(legacySourceDatabase, 'up')
  assert.equal(legacySourceMigrations.length, 4)
  assert.ok(legacySourceMigrations.every((migration) => migration.applied))

  stage = 'seeding synthetic source data under the exact four-migration baseline'
  const legacyFixture = await createSchoolFixture(legacySourceDatabase)
  const legacyFakePasswordHash = 'synthetic-four-migration-transfer-hash-not-valid-for-login'
  await legacySourceDatabase`
    update public.teacher_accounts
    set password_hash = ${legacyFakePasswordHash}, session_version = 9
    where id = ${legacyFixture.teacherId}
  `
  await legacySourceDatabase`
    insert into public.teacher_sessions (id, teacher_id, session_version, expires_at)
    values (${randomUUID()}, ${legacyFixture.teacherId}, 9, statement_timestamp() + interval '1 day')
  `
  await legacySourceDatabase`
    insert into public.audit_events (actor_kind, entity_type, entity_id, event_type, new_value)
    values ('system', 'synthetic_four_migration_probe', ${randomUUID()}, 'insert', '{"fixture":true}'::jsonb)
  `
  for (let weekday = 0; weekday < 7; weekday += 1) {
    await setRoutineSchoolDay(legacySourceDatabase, {
      schoolId: legacyFixture.schoolId,
      dayOfWeek: weekday,
      effectiveFrom: addDays(legacyFixture.today, -20),
      isSchoolDay: false,
    })
  }
  for (const date of [legacyFixture.membershipStart, legacyFixture.today]) {
    await recordAttendance(legacySourceDatabase, legacyFixture.membershipOneId, legacyFixture.semesterId, date)
    await recordAttendance(legacySourceDatabase, legacyFixture.membershipTwoId, legacyFixture.semesterId, date)
  }
  const legacyPreview = await getSemesterClosurePreview(legacySourceDatabase, {
    semesterId: legacyFixture.semesterId,
    teacherId: legacyFixture.teacherId,
  })
  assert.ok(legacyPreview?.calendarConfigured)
  assert.equal(legacyPreview.incompleteSchoolDayCount, 0)
  await withAuditActor(legacySourceDatabase, legacyFixture.teacherId, (transaction) => closeSemester(transaction, {
    semesterId: legacyFixture.semesterId,
    teacherId: legacyFixture.teacherId,
    previewToken: legacyPreview.previewToken,
    confirmed: true,
  }))
  assert.equal((await legacySourceDatabase`select status from public.semesters where id = ${legacyFixture.semesterId}`)[0].status, 'closed')

  const legacySourceMetadata = await inspectSourceDatabase(legacySourceDatabase, { synthetic: true })
  assert.deepEqual(Object.keys(legacySourceMetadata.sourceMigrations).sort(), [
    '0001_core',
    '0002_authentication',
    '0003_semester_archive_snapshots',
    '0004_attendance_manual_clear',
  ])
  assert.equal(await count(legacySourceDatabase, 'teacher_sessions'), 1)
  assert.ok((await legacySourceDatabase`select count(*)::int as count from public.audit_events`)[0].count > 0)

  const upgradedTargetMigrations = await runMigrations(upgradeTargetDatabase, 'up')
  assert.equal(upgradedTargetMigrations.length, 6)
  assert.ok(upgradedTargetMigrations.every((migration) => migration.applied))

  stage = 'creating the four-to-six synthetic snapshot archive'
  const upgradeRestoreDirectory = path.join(upgradeRunDirectory, 'rehearsal')
  await mkdir(upgradeRestoreDirectory)
  protectDirectory(upgradeRestoreDirectory)
  const upgradeArchivePath = path.join(upgradeRunDirectory, upgradeArchiveName)
  const upgradeBackup = await createCustomArchive({
    sourceUrl: legacySourceTemporary.migrationUrl,
    destination: upgradeArchivePath,
    artifactDirectory: upgradeRunDirectory,
    pgBinDirectory,
    synthetic: true,
  })
  assert.ok(upgradeBackup.archiveBytes > 0)
  const upgradeRestoredSql = await readRestoreSqlFromArchive(upgradeArchivePath, {
    privateDirectory: upgradeRunDirectory,
    pgBinDirectory,
    rehearsal: true,
  })
  const upgradeManifest = await buildManifest({
    archivePath: upgradeArchivePath,
    source: legacySourceMetadata,
    restoredSql: upgradeRestoredSql,
  })
  const upgradeManifestPath = path.join(upgradeRunDirectory, upgradeManifestName)
  await writeFile(upgradeManifestPath, `${JSON.stringify(upgradeManifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  const loadedUpgradeManifest = await loadManifest(upgradeManifestPath, upgradeRunDirectory)
  assert.deepEqual(loadedUpgradeManifest.manifest.targetMigrations, upgradeManifest.targetMigrations)
  assert.deepEqual(loadedUpgradeManifest.manifest.sourceMigrations, upgradeManifest.sourceMigrations)
  await writeFile(upgradeManifestPath, `${JSON.stringify({
    ...upgradeManifest,
    sourceMigrations: { ...upgradeManifest.sourceMigrations, '0005_unreviewed': 'a'.repeat(64) },
  }, null, 2)}\n`)
  await assert.rejects(loadManifest(upgradeManifestPath, upgradeRunDirectory), /migration metadata is invalid/)
  await writeFile(upgradeManifestPath, `${JSON.stringify({
    ...upgradeManifest,
    targetMigrations: upgradeManifest.sourceMigrations,
  }, null, 2)}\n`)
  await assert.rejects(loadManifest(upgradeManifestPath, upgradeRunDirectory), /approved exact baseline/)
  await writeFile(upgradeManifestPath, `${JSON.stringify(upgradeManifest, null, 2)}\n`)
  assert.deepEqual(Object.keys(upgradeManifest.sourceMigrations).sort(), Object.keys(legacySourceMetadata.sourceMigrations).sort())
  assert.equal(Object.keys(upgradeManifest.targetMigrations).length, 6)
  assert.equal(Object.keys(upgradeManifest.sourceMigrations).length, 4)
  assert.equal(upgradeManifest.rowCounts.teacher_accounts, 1)
  assert.ok(upgradeManifest.rowCounts.audit_events > 0)

  stage = 'checking the six-migration target against the exact four-migration source baseline'
  assert.deepEqual(await inspectTargetDatabase(upgradeTargetDatabase, upgradeManifest, { kind: 'synthetic', synthetic: true }), {
    database: 'lab002_test',
    role: 'lab002_migrator',
    postgresMajor: 16,
    ready: true,
  })
  const upgradeRestoreScript = buildRestoreSql(upgradeRestoredSql, upgradeManifest, { kind: 'synthetic' })
  assert.match(upgradeRestoreScript, /count\(\*\) FROM public\.schema_migrations\) <> 6/)
  await runPsqlRestore({
    connectionUrl: upgradeTargetTemporary.migrationUrl,
    script: upgradeRestoreScript,
    kind: 'synthetic',
    pgBinDirectory,
  })
  for (const table of TRANSFER_TABLES) {
    assert.equal(await fullRowDigest(legacySourceDatabase, table), await fullRowDigest(upgradeTargetDatabase, table))
    assert.equal(await count(upgradeTargetDatabase, table), upgradeManifest.rowCounts[table])
  }
  assert.equal(await count(legacySourceDatabase, 'teacher_sessions'), 1)
  assert.equal(await count(upgradeTargetDatabase, 'teacher_sessions'), 0)
  assert.equal(await count(upgradeTargetDatabase, 'login_throttle_attempts', 'private'), 0)
  await assertPublicTriggersEnabled(upgradeTargetDatabase)
  await assertForeignKeysValidated(upgradeTargetDatabase)
  await assert.rejects(
    inspectTargetDatabase(upgradeTargetDatabase, upgradeManifest, { kind: 'synthetic', synthetic: true }),
    /Transfer target is not empty\./,
  )

  const totalRows = Object.values(manifest.rowCounts).reduce((sum, value) => sum + value, 0)
  assert.equal(Object.values(upgradeManifest.rowCounts).reduce((sum, value) => sum + value, 0), totalRows)
  console.log(`Synthetic transfer rehearsals passed: exact 6-to-6 and 4-to-6 migration ledgers, ${TRANSFER_TABLES.length} approved tables and ${totalRows} rows; rollback and target guards passed.`)
} catch (error) {
  console.error(`Synthetic transfer rehearsal stopped at stage: ${stage}.`)
  throw error
} finally {
  await Promise.allSettled([
    sourceDatabase?.end({ timeout: 3 }),
    targetDatabase?.end({ timeout: 3 }),
    legacySourceDatabase?.end({ timeout: 3 }),
    upgradeTargetDatabase?.end({ timeout: 3 }),
  ])
  if (runDirectory && archiveName && manifestName) await cleanupArtifactRun(runDirectory, archiveName, manifestName)
  if (upgradeRunDirectory && upgradeArchiveName && upgradeManifestName) {
    await cleanupArtifactRun(upgradeRunDirectory, upgradeArchiveName, upgradeManifestName)
  }
  if (targetTemporary) await targetTemporary.cleanup()
  if (sourceTemporary) await sourceTemporary.cleanup()
  if (legacySourceTemporary) await legacySourceTemporary.cleanup()
  if (upgradeTargetTemporary) await upgradeTargetTemporary.cleanup()
}
