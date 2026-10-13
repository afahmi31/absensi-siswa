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
const reviewedSourceMigrationNames = [
  ...sourceBaselineMigrationNames,
  '0005_private_runtime_access',
  '0006_shared_login_throttle',
]
const applicationFunctionNames = [
  'append_row_audit_event',
  'capture_semester_archive_snapshot',
  'guard_attendance_write',
  'guard_audit_event_mutation',
  'guard_calendar_exception_write',
  'guard_calendar_rule_write',
  'guard_membership_write',
  'guard_semester_archive_snapshot_write',
  'guard_semester_period_change',
  'guard_semester_write',
  'guard_student_identity_write',
  'is_school_day',
  'lock_school_calendar',
  'lock_school_calendar_date',
  'lock_semester_scope_writes',
  'redact_audit_secrets',
  'require_semester_closure_confirmation',
  'school_local_today',
  'sync_active_membership_identity',
  'validate_school_time_zone',
]
const applicationFunctionSignatures = [
  'append_row_audit_event()',
  'capture_semester_archive_snapshot()',
  'guard_attendance_write()',
  'guard_audit_event_mutation()',
  'guard_calendar_exception_write()',
  'guard_calendar_rule_write()',
  'guard_membership_write()',
  'guard_semester_archive_snapshot_write()',
  'guard_semester_period_change()',
  'guard_semester_write()',
  'guard_student_identity_write()',
  'is_school_day(uuid, date)',
  'lock_school_calendar(uuid)',
  'lock_school_calendar_date(uuid, date)',
  'lock_semester_scope_writes()',
  'redact_audit_secrets(jsonb)',
  'require_semester_closure_confirmation()',
  'school_local_today(uuid)',
  'sync_active_membership_identity()',
  'validate_school_time_zone()',
]
const pinnedApplicationPath = 'search_path=pg_catalog, public, pg_temp'

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

async function readApplicationFunctionMetadata(database) {
  const rows = await database`
    select function_row.proname as name,
           pg_catalog.oidvectortypes(function_row.proargtypes) as identity_arguments,
           pg_catalog.pg_get_userbyid(function_row.proowner) as owner,
           coalesce(function_row.proacl::text, '<default>') as acl,
           function_row.prosrc as source,
           function_row.probin as binary_source,
           function_row.proconfig as configuration,
           function_row.prosecdef as security_definer,
           language_row.lanname as language
    from pg_catalog.pg_proc as function_row
    join pg_catalog.pg_namespace as function_schema on function_schema.oid = function_row.pronamespace
    join pg_catalog.pg_language as language_row on language_row.oid = function_row.prolang
    where function_schema.nspname = 'public'
      and function_row.proname = any(${database.array(applicationFunctionNames)})
    order by function_row.proname, pg_catalog.oidvectortypes(function_row.proargtypes)
  `
  return rows.map((row) => ({
    ...row,
    signature: `${row.name}(${row.identity_arguments})`,
    configuration: row.configuration ?? null,
  }))
}

function assertFunctionInventoryAndPath(metadata, pinned) {
  assert.deepEqual(metadata.map((row) => row.signature), [...applicationFunctionSignatures].sort())
  for (const row of metadata) {
    const expectedConfiguration = row.signature === 'append_row_audit_event()' || pinned
      ? [pinnedApplicationPath]
      : null
    assert.deepEqual(row.configuration, expectedConfiguration, `${row.signature} search_path configuration`)
  }
}

function functionMetadataWithoutConfiguration(metadata) {
  return metadata.map(({ configuration, ...row }) => row)
}

async function readPublicCreatePrivileges(database) {
  return database`
    select role_row.rolname as role,
           pg_catalog.has_schema_privilege(role_row.rolname, 'public', 'CREATE') as can_create
    from pg_catalog.pg_roles as role_row
    where role_row.rolname = any(${database.array(['lab002_app', 'anon', 'authenticated', 'service_role'])})
    order by role_row.rolname
  `
}

async function assertTemporaryRelationShadowsCannotBypassGuards(database, fixture) {
  const rollbackMarker = new Error('Rollback the temporary relation shadow probes.')
  await assert.rejects(database.begin(async (transaction) => {
    await transaction`
      create temporary table calendar_exceptions on commit drop as
      select * from public.calendar_exceptions
      where school_id = ${fixture.schoolId} and exception_date = ${fixture.today}::date
    `
    await transaction`update pg_temp.calendar_exceptions set kind = 'holiday'`
    await transaction`
      create temporary table semesters on commit drop as
      select * from public.semesters where id = ${fixture.semesterId}
    `
    await transaction`update pg_temp.semesters set status = 'active', closed_at = null`
    await transaction`
      create temporary table semester_memberships on commit drop as
      select * from public.semester_memberships where id = ${fixture.membershipOneId}
    `
    await transaction`
      create temporary table schools on commit drop as
      select * from public.schools where id = ${fixture.schoolId}
    `
    await transaction`
      create temporary table attendance_records on commit drop as
      select * from public.attendance_records where false
    `

    const [schoolDay] = await transaction`
      select public.is_school_day(${fixture.schoolId}::uuid, ${fixture.today}::date) as is_school_day
    `
    assert.equal(schoolDay.is_school_day, true, 'the application function must use the public calendar exception')

    const [publicException] = await transaction`
      select id, kind from public.calendar_exceptions
      where school_id = ${fixture.schoolId} and exception_date = ${fixture.today}::date
    `
    assert.equal(publicException.kind, 'school_day')
    await transaction`select set_config('app.actor_id', ${fixture.teacherId}, true)`
    await transaction`savepoint calendar_guard_probe`
    let calendarGuardError
    try {
      await transaction`
        update public.calendar_exceptions set kind = 'holiday' where id = ${publicException.id}
      `
    } catch (error) {
      calendarGuardError = error
    }
    assert.ok(calendarGuardError, 'the calendar guard must reject a closed-semester mutation')
    assert.match(calendarGuardError.message, /calendar changes cannot rewrite a closed semester/)
    await transaction`rollback to savepoint calendar_guard_probe`
    await transaction`release savepoint calendar_guard_probe`

    const [attendance] = await transaction`
      select id from public.attendance_records
      where membership_id = ${fixture.membershipOneId} and semester_id = ${fixture.semesterId}
        and attendance_date = ${fixture.today}::date
    `
    assert.ok(attendance)
    await transaction`savepoint attendance_guard_probe`
    let attendanceGuardError
    try {
      await transaction`
        update public.attendance_records
        set status = 'S', version = version + 1
        where id = ${attendance.id}
      `
    } catch (error) {
      attendanceGuardError = error
    }
    assert.ok(attendanceGuardError, 'the attendance guard must reject a closed-semester mutation')
    assert.match(attendanceGuardError.message, /closed semester attendance is immutable/)
    await transaction`rollback to savepoint attendance_guard_probe`
    await transaction`release savepoint attendance_guard_probe`

    throw rollbackMarker
  }), (error) => error === rollbackMarker)
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
    const expectedReviewedMigrationFiles = reviewedSourceMigrationNames.flatMap((name) => [`${name}.up.sql`, `${name}.down.sql`]).sort()
    const resolvedMigrations = await realpath(baselineMigrations).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    if (resolvedMigrations !== null) {
      if (path.dirname(resolvedMigrations) !== resolvedBaselineRoot || path.basename(resolvedMigrations) !== 'migrations') {
        throw new Error('Refusing to clean an unexpected copied source migration path.')
      }
      const migrationFiles = await readdir(baselineMigrations)
      if (migrationFiles.some((name) => !expectedReviewedMigrationFiles.includes(name))) {
        throw new Error('Unexpected file found in the copied source baseline migration directory.')
      }
      for (const name of migrationFiles) await unlink(path.join(baselineMigrations, name))
      await rmdir(baselineMigrations)
    }
    await unlink(path.join(baselineRoot, 'migrate.mjs')).catch((error) => { if (error?.code !== 'ENOENT') throw error })
    await rmdir(baselineRoot)
  }
  for (const name of [archiveName, manifestName]) {
    if (name === null || name === undefined) continue
    if (!/^(snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump|snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json)$/.test(name)) {
      throw new Error('Refusing to clean a file outside the generated snapshot naming pattern.')
    }
    await unlink(path.join(root, name)).catch((error) => { if (error?.code !== 'ENOENT') throw error })
  }
  await rmdir(root)
}

async function createSourceBaselineMigrationRunner(runDirectory, migrationNames) {
  const isApprovedBaseline = [sourceBaselineMigrationNames, reviewedSourceMigrationNames]
    .some((approved) => approved.length === migrationNames.length && approved.every((name, index) => name === migrationNames[index]))
  if (!isApprovedBaseline) throw new Error('Refusing to create an unapproved synthetic source migration baseline.')
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
  for (const name of migrationNames) {
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
  stage = 'applying the reviewed six-migration source and current target migrations to synthetic clusters'
  const runReviewedSourceMigrations = await createSourceBaselineMigrationRunner(runDirectory, reviewedSourceMigrationNames)
  const sourceMigrations = await runReviewedSourceMigrations(sourceDatabase, 'up')
  const targetMigrations = await runMigrations(targetDatabase, 'up')
  assert.equal(sourceMigrations.length, 6)
  assert.equal(targetMigrations.length, 7)

  stage = 'verifying the exact application-function search_path migration and rollback'
  const sourceFunctionMetadata = await readApplicationFunctionMetadata(sourceDatabase)
  const targetFunctionMetadata = await readApplicationFunctionMetadata(targetDatabase)
  assertFunctionInventoryAndPath(sourceFunctionMetadata, false)
  assertFunctionInventoryAndPath(targetFunctionMetadata, true)
  assert.deepEqual(
    functionMetadataWithoutConfiguration(targetFunctionMetadata),
    functionMetadataWithoutConfiguration(sourceFunctionMetadata),
    'the migration must preserve function bodies, owners, grants, and security mode',
  )
  const sourceCreatePrivileges = await readPublicCreatePrivileges(sourceDatabase)
  const targetCreatePrivileges = await readPublicCreatePrivileges(targetDatabase)
  assert.deepEqual(targetCreatePrivileges, sourceCreatePrivileges)
  assert.ok(targetCreatePrivileges.every((row) => !row.can_create), 'runtime and API roles must not gain public CREATE')

  const migrationDownSql = await readFile(
    path.join(appRoot, 'server', 'database', 'migrations', '0007_application_function_search_path.down.sql'),
    'utf8',
  )
  await targetDatabase.begin(async (transaction) => {
    await transaction.unsafe(migrationDownSql).simple()
    const removedLedger = await transaction`
      delete from public.schema_migrations
      where name = '0007_application_function_search_path'
      returning name
    `
    assert.deepEqual(removedLedger.map((row) => row.name), ['0007_application_function_search_path'])
  })
  const targetAfterDown = await readApplicationFunctionMetadata(targetDatabase)
  assertFunctionInventoryAndPath(targetAfterDown, false)
  assert.deepEqual(targetAfterDown, sourceFunctionMetadata, 'down must restore every function property to the reviewed six-migration baseline')
  assert.equal((await targetDatabase`select count(*)::int as count from public.schema_migrations`)[0].count, 6)

  const reappliedMigrations = await runMigrations(targetDatabase, 'up')
  assert.equal(reappliedMigrations.length, 7)
  assert.equal(reappliedMigrations.at(-1).name, '0007_application_function_search_path')
  assert.equal(reappliedMigrations.at(-1).applied, true)
  const targetAfterReapply = await readApplicationFunctionMetadata(targetDatabase)
  assertFunctionInventoryAndPath(targetAfterReapply, true)
  assert.deepEqual(
    functionMetadataWithoutConfiguration(targetAfterReapply),
    functionMetadataWithoutConfiguration(sourceFunctionMetadata),
    'reapplying must leave all function bodies, owners, grants, and security mode unchanged',
  )
  assert.deepEqual(await readPublicCreatePrivileges(targetDatabase), sourceCreatePrivileges)

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
  assert.deepEqual(Object.keys(manifest.sourceMigrations).sort(), [...reviewedSourceMigrationNames].sort())
  assert.equal(Object.keys(manifest.targetMigrations).length, 7)
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

  stage = 'checking temporary relation shadow resistance for calendar and attendance guards'
  await assertTemporaryRelationShadowsCannotBypassGuards(targetDatabase, fixture)
  for (const table of ['calendar_exceptions', 'attendance_records', 'audit_events']) {
    assert.equal(await fullRowDigest(sourceDatabase, table), await fullRowDigest(targetDatabase, table))
  }

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

  stage = 'preparing an exact four-migration source against the seven-migration target'
  legacySourceTemporary = await startTemporaryPostgres()
  legacySourceDatabase = postgres(legacySourceTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  upgradeTargetTemporary = await startTemporaryPostgres()
  upgradeTargetDatabase = postgres(upgradeTargetTemporary.migrationUrl, { max: 1, connect_timeout: 5 })
  upgradeRunDirectory = path.join(artifactParent, `run-${randomUUID()}`)
  upgradeArchiveName = `${generatedSnapshotName()}.dump`
  upgradeManifestName = upgradeArchiveName.replace(/\.dump$/, '.json')
  await mkdir(upgradeRunDirectory)
  protectDirectory(upgradeRunDirectory)
  const runLegacyMigrations = await createSourceBaselineMigrationRunner(upgradeRunDirectory, sourceBaselineMigrationNames)
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
  assert.equal(upgradedTargetMigrations.length, 7)
  assert.ok(upgradedTargetMigrations.every((migration) => migration.applied))

  stage = 'creating the four-to-seven synthetic snapshot archive'
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
    sourceMigrations: Object.fromEntries(Object.entries(upgradeManifest.targetMigrations).slice(0, 5)),
  }, null, 2)}\n`)
  await assert.rejects(loadManifest(upgradeManifestPath, upgradeRunDirectory), /migration metadata is invalid/)
  await writeFile(upgradeManifestPath, `${JSON.stringify({
    ...upgradeManifest,
    targetMigrations: upgradeManifest.sourceMigrations,
  }, null, 2)}\n`)
  await assert.rejects(loadManifest(upgradeManifestPath, upgradeRunDirectory), /approved exact baseline/)
  await writeFile(upgradeManifestPath, `${JSON.stringify(upgradeManifest, null, 2)}\n`)
  assert.deepEqual(Object.keys(upgradeManifest.sourceMigrations).sort(), Object.keys(legacySourceMetadata.sourceMigrations).sort())
  assert.equal(Object.keys(upgradeManifest.targetMigrations).length, 7)
  assert.equal(Object.keys(upgradeManifest.sourceMigrations).length, 4)
  assert.equal(upgradeManifest.rowCounts.teacher_accounts, 1)
  assert.ok(upgradeManifest.rowCounts.audit_events > 0)

  stage = 'checking the seven-migration target against the exact four-migration source baseline'
  assert.deepEqual(await inspectTargetDatabase(upgradeTargetDatabase, upgradeManifest, { kind: 'synthetic', synthetic: true }), {
    database: 'lab002_test',
    role: 'lab002_migrator',
    postgresMajor: 16,
    ready: true,
  })
  const upgradeRestoreScript = buildRestoreSql(upgradeRestoredSql, upgradeManifest, { kind: 'synthetic' })
  assert.match(upgradeRestoreScript, /count\(\*\) FROM public\.schema_migrations\) <> 7/)
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
  console.log(`Synthetic transfer rehearsals passed: exact 6-to-7 and 4-to-7 migration ledgers, ${TRANSFER_TABLES.length} approved tables and ${totalRows} rows; rollback and target guards passed.`)
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
  if (runDirectory) await cleanupArtifactRun(runDirectory, archiveName, manifestName)
  if (upgradeRunDirectory) await cleanupArtifactRun(upgradeRunDirectory, upgradeArchiveName, upgradeManifestName)
  if (targetTemporary) await targetTemporary.cleanup()
  if (sourceTemporary) await sourceTemporary.cleanup()
  if (legacySourceTemporary) await legacySourceTemporary.cleanup()
  if (upgradeTargetTemporary) await upgradeTargetTemporary.cleanup()
}
