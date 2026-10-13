import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, realpath, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import postgres from 'postgres'

export const TRANSFER_TABLES = Object.freeze([
  'teacher_accounts',
  'schools',
  'school_classes',
  'semesters',
  'students',
  'semester_memberships',
  'school_calendar_rules',
  'calendar_exceptions',
  'attendance_records',
  'semester_archive_snapshots',
  'audit_events',
])

export const EXCLUDED_TABLES = Object.freeze([
  'teacher_sessions',
  'schema_migrations',
  'private.login_throttle_attempts',
])

const projectRef = 'jkiewjlohgmsujcwerpi'
const sourceRole = 'lab002_migrator'
const cloudUsername = `lab002_migrator.${projectRef}`
const cloudRole = 'lab002_migrator'
const maxSqlBytes = 256 * 1024 * 1024
const migrationDirectory = new URL('../server/database/migrations/', import.meta.url)
const approvedSourceBaseline = Object.freeze({
  '0001_core': '74847c149d17160b97ac9499e6563ab21f5da11985627176d88975f741febcf8',
  '0002_authentication': '36ab4f6d7b8b11668ef16e21af15536325f4feff3194c46005adf622e765bd7d',
  '0003_semester_archive_snapshots': '4f8d98bb05f1a188a394c8a88916323ad580d101a482d0c4d853f9db77c8a56c',
  '0004_attendance_manual_clear': '81749cdc9ad0e51a3453454d4364f848863cf94df5c0d60b37d83d5ee7fdd46a',
})
const approvedFullSourceNames = Object.freeze([
  '0001_core',
  '0002_authentication',
  '0003_semester_archive_snapshots',
  '0004_attendance_manual_clear',
  '0005_private_runtime_access',
  '0006_shared_login_throttle',
])

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error('Transfer metadata contains an invalid identifier.')
  return `"${identifier}"`
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeConnectionUrl(connectionUrl, mode) {
  let url
  try {
    url = new URL(connectionUrl)
  } catch {
    throw new Error('Database connection settings are invalid.')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.password) {
    throw new Error('Database connection settings are invalid.')
  }
  const parameters = [...url.searchParams.entries()]
  if (parameters.some(([name]) => name.toLowerCase() !== 'sslmode')) {
    throw new Error('Database connection settings contain unsupported options.')
  }
  const sslMode = url.searchParams.get('sslmode')?.toLowerCase()
  if (mode === 'local' && sslMode !== 'disable') {
    throw new Error('Local transfer connections must explicitly use the managed loopback database.')
  }
  if (mode === 'cloud' && sslMode && !['require', 'verify-full'].includes(sslMode)) {
    throw new Error('Cloud TLS settings must not weaken certificate verification.')
  }
  url.search = ''
  return url
}

export function validateManagedSourceUrl(connectionUrl) {
  const url = normalizeConnectionUrl(connectionUrl, 'local')
  if (
    url.hostname !== '127.0.0.1'
    || url.port !== '55432'
    || url.pathname !== '/lab002_local'
    || decodeURIComponent(url.username) !== sourceRole
  ) {
    throw new Error('Transfer source must be the managed local PostgreSQL 16 database.')
  }
  return url
}

export function validateCloudTargetUrl(connectionUrl) {
  const url = normalizeConnectionUrl(connectionUrl, 'cloud')
  const username = decodeURIComponent(url.username)
  if (
    url.hostname !== url.hostname.toLowerCase()
    || !/^[a-z0-9-]+\.ap-southeast-1\.pooler\.supabase\.com$/.test(url.hostname)
    || url.port !== '5432'
    || url.pathname !== '/postgres'
    || username !== cloudUsername
  ) {
    throw new Error('Cloud target must be the approved project session pooler and dedicated migration role.')
  }
  return url
}

export function validateSyntheticDatabaseUrl(connectionUrl) {
  const url = normalizeConnectionUrl(connectionUrl, 'local')
  const port = Number(url.port)
  if (
    url.hostname !== '127.0.0.1'
    || !Number.isInteger(port)
    || port < 1
    || port > 65535
    || url.pathname !== '/lab002_test'
    || decodeURIComponent(url.username) !== sourceRole
  ) {
    throw new Error('Synthetic rehearsal requires its disposable loopback PostgreSQL database.')
  }
  return url
}

export function makeDatabaseClient(connectionUrl, { kind = 'local', caCertificate = '' } = {}) {
  const url = kind === 'cloud'
    ? validateCloudTargetUrl(connectionUrl)
    : kind === 'synthetic'
      ? validateSyntheticDatabaseUrl(connectionUrl)
      : validateManagedSourceUrl(connectionUrl)

  const options = {
    max: 1,
    idle_timeout: 2,
    connect_timeout: 5,
    prepare: false,
  }
  if (kind === 'cloud') {
    if (!caCertificate.includes('-----BEGIN CERTIFICATE-----') || !caCertificate.includes('-----END CERTIFICATE-----')) {
      throw new Error('A valid Supabase database CA certificate is required.')
    }
    options.ssl = {
      ca: caCertificate,
      rejectUnauthorized: true,
      servername: url.hostname,
    }
  }
  return postgres(url.toString(), options)
}

export async function expectedMigrationChecksums() {
  const { readdir } = await import('node:fs/promises')
  const directory = new URL(migrationDirectory)
  const names = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name))
    .sort()
  const records = {}
  for (const upName of names) {
    const baseName = upName.replace(/\.up\.sql$/, '')
    const downName = `${baseName}.down.sql`
    const [upSql, downSql] = await Promise.all([
      readFile(new URL(upName, migrationDirectory), 'utf8'),
      readFile(new URL(downName, migrationDirectory), 'utf8'),
    ])
    records[baseName] = sha256(`${upSql}\0${downSql}`)
  }
  return records
}

async function readSchemaShape(database) {
  const rows = await database`
    select table_class.relname as table_name,
           attribute.attname as column_name,
           pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as column_type,
           attribute.attnotnull as not_null,
           attribute.attidentity as identity_kind,
           attribute.attgenerated as generated_kind
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    join pg_catalog.pg_attribute as attribute on attribute.attrelid = table_class.oid
    where table_schema.nspname = 'public'
      and table_class.relkind = 'r'
      and table_class.relname = any(${database.array(TRANSFER_TABLES)})
      and attribute.attnum > 0
      and not attribute.attisdropped
    order by table_class.relname, attribute.attnum
  `
  const columns = Object.fromEntries(TRANSFER_TABLES.map((name) => [name, []]))
  for (const row of rows) columns[row.table_name].push(row.column_name)
  if (TRANSFER_TABLES.some((name) => columns[name].length === 0)) {
    throw new Error('Database schema is missing a required transfer table.')
  }
  return {
    columns,
    fingerprint: sha256(JSON.stringify(rows)),
  }
}

async function readMigrationLedger(database) {
  const rows = await database`select name, checksum from public.schema_migrations order by name`
  return Object.fromEntries(rows.map((row) => [row.name, row.checksum]))
}

function sameLedger(actual, expected) {
  const actualNames = Object.keys(actual ?? {}).sort()
  const expectedNames = Object.keys(expected ?? {}).sort()
  return actualNames.length === expectedNames.length
    && actualNames.every((name, index) => name === expectedNames[index] && actual[name] === expected[name])
}

async function expectedSourceMigrationSets() {
  const current = await expectedMigrationChecksums()
  const baselineNames = Object.keys(approvedSourceBaseline)
  const currentBaseline = Object.fromEntries(baselineNames.map((name) => [name, current[name]]))
  if (!sameLedger(currentBaseline, approvedSourceBaseline)) {
    throw new Error('The reviewed local source migration baseline has changed.')
  }
  const sets = [approvedSourceBaseline]
  if (sameLedger(current, Object.fromEntries(approvedFullSourceNames.map((name) => [name, current[name]])))) {
    sets.push(current)
  }
  return sets
}

async function verifySourceMigrationLedger(actual) {
  const allowedSets = await expectedSourceMigrationSets()
  if (!allowedSets.some((expected) => sameLedger(actual, expected))) {
    throw new Error('Transfer source migration ledger is not an approved exact baseline.')
  }
  return actual
}

async function readAuditSequenceIncrement(database) {
  const rows = await database`
    select sequence.seqincrement::text as increment_by
    from pg_catalog.pg_sequence as sequence
    where sequence.seqrelid = 'public.audit_events_id_seq'::regclass
  `
  if (rows.length !== 1 || rows[0].increment_by !== '1') {
    throw new Error('Audit sequence definition is not the expected increment-by-one identity sequence.')
  }
  return rows[0].increment_by
}

export async function inspectSourceDatabase(database, { synthetic = false } = {}) {
  const [identity] = await database`
    select current_database() as database_name,
           current_user as role_name,
           current_setting('server_version_num')::int as version_num
  `
  if (
    identity.role_name !== sourceRole
    || (synthetic ? identity.database_name !== 'lab002_test' : identity.database_name !== 'lab002_local')
    || Math.floor(Number(identity.version_num) / 10000) !== 16
  ) {
    throw new Error('Transfer source database identity or PostgreSQL version is not approved.')
  }
  const [schema, migrations, incrementBy] = await Promise.all([
    readSchemaShape(database),
    readMigrationLedger(database),
    readAuditSequenceIncrement(database),
  ])
  const sourceMigrations = await verifySourceMigrationLedger(migrations)
  return {
    database: identity.database_name,
    role: identity.role_name,
    postgresMajor: 16,
    ...schema,
    sourceMigrations,
    auditSequenceIncrement: incrementBy,
  }
}

export async function inspectTargetDatabase(database, manifest, { kind = 'cloud', synthetic = false } = {}) {
  const [identity] = await database`
    select current_database() as database_name,
           current_user as role_name,
           current_setting('server_version_num')::int as version_num
  `
  const expectedRole = kind === 'cloud' ? cloudRole : sourceRole
  const expectedDatabase = kind === 'cloud' ? 'postgres' : 'lab002_test'
  const expectedMajor = kind === 'cloud' ? 17 : 16
  if (
    identity.role_name !== expectedRole
    || identity.database_name !== expectedDatabase
    || Math.floor(Number(identity.version_num) / 10000) !== expectedMajor
    || (synthetic && kind !== 'synthetic')
  ) {
    throw new Error('Transfer target database identity or PostgreSQL version is not approved.')
  }

  const expectedLedger = await expectedMigrationChecksums()
  const ledger = await database`select name, checksum from public.schema_migrations order by name`
  const actualLedger = Object.fromEntries(ledger.map((row) => [row.name, row.checksum]))
  if (!sameLedger(actualLedger, expectedLedger)) {
    throw new Error('Transfer target migration ledger does not match the checked application migrations.')
  }

  const schema = await readSchemaShape(database)
  if (schema.fingerprint !== manifest.schemaFingerprint || JSON.stringify(schema.columns) !== JSON.stringify(manifest.columns)) {
    throw new Error('Transfer source and target schemas do not match the reviewed migration set.')
  }
  if (!sameLedger(expectedLedger, manifest.targetMigrations)) {
    throw new Error('Transfer archive migration checksums do not match the checked application migrations.')
  }

  const requiredRelations = [...TRANSFER_TABLES, 'teacher_sessions', 'schema_migrations']
  const relations = await database`
    select table_class.relname as table_name,
           table_schema.nspname as schema_name,
           table_class.relowner = (select oid from pg_catalog.pg_roles where rolname = current_user) as owned_by_current_role,
           table_class.relrowsecurity as row_security_enabled
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where (table_schema.nspname = 'public' and table_class.relname = any(${database.array(requiredRelations.filter((name) => name !== 'teacher_sessions'))}))
       or (table_schema.nspname = 'public' and table_class.relname = 'teacher_sessions')
       or (table_schema.nspname = 'private' and table_class.relname = 'login_throttle_attempts')
  `
  const found = new Set(relations.map((row) => `${row.schema_name}.${row.table_name}`))
  if (requiredRelations.some((name) => !found.has(`public.${name}`)) || !found.has('private.login_throttle_attempts')) {
    throw new Error('Transfer target is missing a required migrated table.')
  }
  if (relations.some((row) => !row.owned_by_current_role)) {
    throw new Error('Transfer target migration role must own the application tables before a restore.')
  }
  if (relations.some((row) => !row.row_security_enabled)) {
    throw new Error('Transfer target application tables must have row-level security enabled.')
  }

  const extraTables = await database`
    select table_class.relname as table_name
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relkind in ('r', 'p')
      and table_class.relname <> all(${database.array([...requiredRelations])})
  `
  if (extraTables.length > 0) throw new Error('Transfer target has unexpected public tables.')

  const securityRows = await database`
    select
      exists (
        select 1 from pg_catalog.pg_namespace as n
        where n.nspname = 'public'
          and (
            has_schema_privilege('anon', n.oid, 'USAGE')
            or has_schema_privilege('authenticated', n.oid, 'USAGE')
            or has_schema_privilege('service_role', n.oid, 'USAGE')
          )
      ) as api_schema_access,
      exists (
        select 1 from pg_catalog.pg_namespace as n
        where n.nspname = 'private'
          and (
            has_schema_privilege('anon', n.oid, 'USAGE')
            or has_schema_privilege('authenticated', n.oid, 'USAGE')
            or has_schema_privilege('service_role', n.oid, 'USAGE')
          )
      ) as api_private_schema_access,
      exists (
        select 1 from pg_catalog.pg_class as c
        join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
          and (
            has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          )
      ) as api_object_access,
      exists (
        select 1 from pg_catalog.pg_class as c
        join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
        where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm', 'S')
          and (
            has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          )
      ) as api_private_object_access,
      exists (
        select 1 from pg_catalog.pg_proc as p
        join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and (
            has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE')
            or has_function_privilege('service_role', p.oid, 'EXECUTE')
          )
      ) as api_function_access,
      exists (
        select 1 from pg_catalog.pg_proc as p
        join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'private'
          and (
            has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE')
            or has_function_privilege('service_role', p.oid, 'EXECUTE')
          )
      ) as api_private_function_access
  `
  if (
    securityRows[0].api_schema_access
    || securityRows[0].api_private_schema_access
    || securityRows[0].api_object_access
    || securityRows[0].api_private_object_access
    || securityRows[0].api_function_access
    || securityRows[0].api_private_function_access
  ) {
    throw new Error('Transfer target still grants Supabase API roles access to application objects.')
  }

  const unvalidatedForeignKeys = await database`
    select count(*)::int as count
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as table_class on table_class.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where constraint_row.contype = 'f'
      and table_schema.nspname in ('public', 'private')
      and not constraint_row.convalidated
  `
  if (Number(unvalidatedForeignKeys[0].count) !== 0) throw new Error('Transfer target has an unvalidated foreign key.')

  const triggerState = await database`
    select count(*)::int as disabled
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as table_class on table_class.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname = any(${database.array(requiredRelations)})
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'O'
  `
  if (Number(triggerState[0].disabled) !== 0) throw new Error('Transfer target has a user trigger that is not enabled normally.')

  const emptyTargets = [...TRANSFER_TABLES, 'teacher_sessions']
  for (const table of emptyTargets) {
    const rows = await database.unsafe(`select exists (select 1 from public.${quoteIdentifier(table)} limit 1) as nonempty`)
    if (rows[0].nonempty) throw new Error('Transfer target is not empty.')
  }
  const throttleRows = await database`select exists (select 1 from private.login_throttle_attempts limit 1) as nonempty`
  if (throttleRows[0].nonempty) throw new Error('Transfer target is not empty.')

  return {
    database: identity.database_name,
    role: identity.role_name,
    postgresMajor: expectedMajor,
    ready: true,
  }
}

function parseCopyHeader(line) {
  const match = line.match(/^COPY public\.([a-z_][a-z0-9_]*) \(([^)]*)\) FROM stdin;$/)
  if (!match) return null
  const table = match[1]
  const columns = match[2].split(',').map((column) => column.trim().replace(/^"([a-z_][a-z0-9_]*)"$/, '$1'))
  if (columns.length === 0 || columns.some((column) => !/^[a-z_][a-z0-9_]*$/.test(column))) {
    throw new Error('Transfer archive has an unsupported COPY column list.')
  }
  return { table, columns }
}

export function parseRestoredDump(restoredSql) {
  if (typeof restoredSql !== 'string' || Buffer.byteLength(restoredSql, 'utf8') > maxSqlBytes) {
    throw new Error('Transfer archive SQL exceeds the reviewed in-memory limit.')
  }
  const lines = restoredSql.split(/\r?\n/)
  const copyBlocks = []
  let sequence = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || line.startsWith('--')) continue
    const header = parseCopyHeader(line)
    if (header) {
      if (!TRANSFER_TABLES.includes(header.table) || copyBlocks.some((block) => block.table === header.table)) {
        throw new Error('Transfer archive contains an unexpected or duplicate data table.')
      }
      const data = []
      let terminated = false
      for (index += 1; index < lines.length; index += 1) {
        if (lines[index] === '\\.') {
          terminated = true
          break
        }
        data.push(lines[index])
      }
      if (!terminated) throw new Error('Transfer archive has an incomplete COPY section.')
      copyBlocks.push({ table: header.table, columns: header.columns, data })
      continue
    }

    const sequenceSet = line.match(/^SELECT pg_catalog\.setval\('public\.audit_events_id_seq', ([0-9]+), (true|false)\);$/)
    if (sequenceSet) {
      if (sequence) throw new Error('Transfer archive has duplicate audit sequence state.')
      sequence = { lastValue: sequenceSet[1], isCalled: sequenceSet[2] === 'true' }
      continue
    }

    if (/^SET (?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security) = .+;$/.test(line)) continue
    if (/^SELECT pg_catalog\.set_config\('search_path', '', false\);$/.test(line)) continue
    if (/^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line)) continue
    throw new Error('Transfer archive contains an unsupported SQL command; no database write was started.')
  }
  if (copyBlocks.length !== TRANSFER_TABLES.length || TRANSFER_TABLES.some((table) => !copyBlocks.some((block) => block.table === table))) {
    throw new Error('Transfer archive does not contain every approved application table.')
  }
  if (!sequence) throw new Error('Transfer archive does not include the audit sequence state.')
  const rowCounts = Object.fromEntries(TRANSFER_TABLES.map((table) => [table, 0]))
  for (const block of copyBlocks) rowCounts[block.table] = block.data.length
  return { copyBlocks, rowCounts, sequence }
}

export async function buildManifest({ archivePath, source, restoredSql, generatedAt = new Date().toISOString() }) {
  const dump = parseRestoredDump(restoredSql)
  for (const block of dump.copyBlocks) {
    if (JSON.stringify(block.columns) !== JSON.stringify(source.columns[block.table])) {
      throw new Error('Transfer archive COPY columns do not match the source schema.')
    }
  }
  const archive = await readFile(archivePath)
  const archiveName = path.basename(archivePath)
  if (!/^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump$/.test(archiveName)) {
    throw new Error('Transfer archive filename is not an owned snapshot artifact.')
  }
  return {
    formatVersion: 1,
    generatedAt,
    archiveName,
    archiveSha256: sha256(archive),
    schemaFingerprint: source.fingerprint,
    columns: source.columns,
    sourceMigrations: source.sourceMigrations,
    targetMigrations: await expectedMigrationChecksums(),
    postgresMajor: source.postgresMajor,
    rowCounts: dump.rowCounts,
    auditSequence: {
      ...dump.sequence,
      incrementBy: source.auditSequenceIncrement,
    },
    transferredTables: [...TRANSFER_TABLES],
    excludedTables: [...EXCLUDED_TABLES],
  }
}

function validateManifest(manifest) {
  if (
    manifest?.formatVersion !== 1
    || manifest.postgresMajor !== 16
    || !/^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump$/.test(manifest.archiveName ?? '')
    || !/^[a-f0-9]{64}$/.test(manifest.archiveSha256 ?? '')
    || !/^[a-f0-9]{64}$/.test(manifest.schemaFingerprint ?? '')
    || JSON.stringify(manifest.transferredTables) !== JSON.stringify(TRANSFER_TABLES)
    || JSON.stringify(manifest.excludedTables) !== JSON.stringify(EXCLUDED_TABLES)
    || typeof manifest.auditSequence?.lastValue !== 'string'
    || !/^[0-9]+$/.test(manifest.auditSequence.lastValue)
    || typeof manifest.auditSequence?.isCalled !== 'boolean'
    || manifest.auditSequence.incrementBy !== '1'
  ) {
    throw new Error('Transfer manifest is invalid or was created for a different application schema.')
  }
  for (const table of TRANSFER_TABLES) {
    if (
      !Array.isArray(manifest.columns?.[table])
      || manifest.columns[table].length === 0
      || manifest.columns[table].some((column) => !/^[a-z_][a-z0-9_]*$/.test(column))
      || !Number.isSafeInteger(manifest.rowCounts?.[table])
      || manifest.rowCounts[table] < 0
    ) {
      throw new Error('Transfer manifest is missing table metadata.')
    }
  }
  const sourceNames = Object.keys(manifest.sourceMigrations ?? {}).sort()
  const approvedSourceNameSets = [
    Object.keys(approvedSourceBaseline).sort(),
    [...approvedFullSourceNames].sort(),
  ]
  if (
    !approvedSourceNameSets.some((names) => JSON.stringify(names) === JSON.stringify(sourceNames))
    || Object.values(manifest.sourceMigrations).some((checksum) => !/^[a-f0-9]{64}$/.test(checksum))
    || !manifest.targetMigrations
    || Object.keys(manifest.targetMigrations).length === 0
    || Object.entries(manifest.targetMigrations).some(([name, checksum]) => !/^\d{4}_[a-z0-9_]+$/.test(name) || !/^[a-f0-9]{64}$/.test(checksum))
  ) {
    throw new Error('Transfer manifest migration metadata is invalid.')
  }
}

function buildSqlGuard(manifest, target) {
  const migrationValues = Object.entries(manifest.targetMigrations)
    .map(([name, checksum]) => `(${quoteLiteral(name)}, ${quoteLiteral(checksum)})`)
    .join(',\n      ')
  const requiredNames = [...TRANSFER_TABLES, 'teacher_sessions', 'schema_migrations']
  const requiredTableNames = requiredNames.map(quoteLiteral).join(', ')
  const emptiness = [...TRANSFER_TABLES, 'teacher_sessions']
    .map((table) => `IF EXISTS (SELECT 1 FROM public.${quoteIdentifier(table)} LIMIT 1) THEN RAISE EXCEPTION 'transfer target is not empty'; END IF;`)
  emptiness.push("IF EXISTS (SELECT 1 FROM private.login_throttle_attempts LIMIT 1) THEN RAISE EXCEPTION 'transfer target is not empty'; END IF;")
  const rowSecurityChecks = [...TRANSFER_TABLES, 'teacher_sessions', 'schema_migrations']
    .map((table) => `IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.${table}'::regclass) THEN RAISE EXCEPTION 'row security is not enabled'; END IF;`)
  const ownerCheck = `IF EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relname = ANY(ARRAY[${requiredTableNames}]) AND relnamespace = 'public'::regnamespace AND relowner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)) THEN RAISE EXCEPTION 'migration role does not own application tables'; END IF;`
  const privateThrottleOwnerCheck = "IF (SELECT relowner FROM pg_catalog.pg_class WHERE oid = 'private.login_throttle_attempts'::regclass) <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN RAISE EXCEPTION 'migration role does not own the private throttle table'; END IF;"
  const apiPrivilegesCheck = `
    IF has_schema_privilege('anon', 'public', 'USAGE') OR has_schema_privilege('authenticated', 'public', 'USAGE') OR has_schema_privilege('service_role', 'public', 'USAGE') THEN
      RAISE EXCEPTION 'Supabase API roles can access the public schema';
    END IF;
    IF has_schema_privilege('anon', 'private', 'USAGE') OR has_schema_privilege('authenticated', 'private', 'USAGE') OR has_schema_privilege('service_role', 'private', 'USAGE') THEN
      RAISE EXCEPTION 'Supabase API roles can access the private schema';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m','S')
        AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    ) THEN RAISE EXCEPTION 'Supabase API roles can access application tables'; END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS c
      WHERE c.relnamespace = 'private'::regnamespace AND c.relkind IN ('r','p','v','m','S')
        AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    ) THEN RAISE EXCEPTION 'Supabase API roles can access private tables'; END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = 'public'::regnamespace
        AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('service_role', p.oid, 'EXECUTE'))
    ) THEN RAISE EXCEPTION 'Supabase API roles can execute public functions'; END IF;`
  const apiPrivateFunctionCheck = `
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc AS p WHERE p.pronamespace = 'private'::regnamespace
        AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('service_role', p.oid, 'EXECUTE'))
    ) THEN RAISE EXCEPTION 'Supabase API roles can execute private functions'; END IF;`
  const enabledTriggerCheck = `
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger AS t
      JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = ANY(ARRAY[${requiredNames.filter((name) => name !== 'schema_migrations').map(quoteLiteral).join(', ')}])
        AND NOT t.tgisinternal AND t.tgenabled <> 'O'
    ) THEN RAISE EXCEPTION 'a user trigger is not enabled normally'; END IF;`
  const validatedForeignKeysCheck = `
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint AS f
      JOIN pg_catalog.pg_class AS c ON c.oid = f.conrelid
      WHERE f.contype = 'f' AND c.relnamespace IN ('public'::regnamespace, 'private'::regnamespace)
        AND NOT f.convalidated
    ) THEN RAISE EXCEPTION 'an application foreign key is not validated'; END IF;`
  const apiRolesNoFunctionAccess = apiPrivilegesCheck
  const expectedMajor = target.kind === 'cloud' ? 17 : 16
  const expectedDb = target.kind === 'cloud' ? 'postgres' : 'lab002_test'
  const expectedRole = target.kind === 'cloud' ? cloudRole : sourceRole
  return `DO $transfer_guard$
DECLARE
  required_count integer;
  actual_count integer;
BEGIN
  IF current_database() <> ${quoteLiteral(expectedDb)} OR current_user <> ${quoteLiteral(expectedRole)}
     OR floor(current_setting('server_version_num')::integer / 10000) <> ${expectedMajor} THEN
    RAISE EXCEPTION 'transfer database guard failed';
  END IF;
  IF (SELECT count(*) FROM public.schema_migrations) <> ${Object.keys(manifest.targetMigrations).length}
     OR EXISTS (
       SELECT 1 FROM (VALUES ${migrationValues}) AS expected(name, checksum)
       FULL JOIN public.schema_migrations AS actual USING (name)
       WHERE expected.checksum IS DISTINCT FROM actual.checksum
     ) THEN
    RAISE EXCEPTION 'migration ledger mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p')
      AND relname <> ALL(ARRAY[${requiredNames.map(quoteLiteral).join(', ')}])
  ) THEN RAISE EXCEPTION 'unexpected public tables exist'; END IF;
  ${ownerCheck}
  ${privateThrottleOwnerCheck}
  ${rowSecurityChecks.join('\n  ')}
  ${enabledTriggerCheck}
  ${validatedForeignKeysCheck}
  ${apiRolesNoFunctionAccess}
  ${apiPrivateFunctionCheck}
  ${emptiness.join('\n  ')}
END
$transfer_guard$;`
}

function sequenceRestart(manifest) {
  const value = BigInt(manifest.auditSequence.lastValue)
  const increment = BigInt(manifest.auditSequence.incrementBy)
  const nextValue = value + (manifest.auditSequence.isCalled ? increment : 0n)
  if (nextValue < 1n || nextValue > 9223372036854775807n) throw new Error('Audit sequence state is outside its PostgreSQL range.')
  return nextValue.toString()
}

export function buildRestoreSql(restoredSql, manifest, target) {
  validateManifest(manifest)
  const dump = parseRestoredDump(restoredSql)
  for (const table of TRANSFER_TABLES) {
    const block = dump.copyBlocks.find((entry) => entry.table === table)
    if (dump.rowCounts[table] !== manifest.rowCounts[table]) throw new Error('Transfer archive row counts do not match its private manifest.')
    if (block && JSON.stringify(block.columns) !== JSON.stringify(manifest.columns[table])) {
      throw new Error('Transfer archive columns do not match its private manifest.')
    }
  }
  if (
    dump.sequence.lastValue !== manifest.auditSequence.lastValue
    || dump.sequence.isCalled !== manifest.auditSequence.isCalled
  ) {
    throw new Error('Transfer archive audit sequence state does not match its private manifest.')
  }

  const statements = [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '15min';",
    `LOCK TABLE ${[...TRANSFER_TABLES.map((name) => `public.${quoteIdentifier(name)}`), 'public."teacher_sessions"', 'private."login_throttle_attempts"'].join(', ')} IN ACCESS EXCLUSIVE MODE;`,
    buildSqlGuard(manifest, target),
  ]
  for (const table of TRANSFER_TABLES) {
    statements.push(`CREATE TEMP TABLE ${quoteIdentifier(`transfer_${table}`)} (LIKE public.${quoteIdentifier(table)} INCLUDING GENERATED INCLUDING IDENTITY) ON COMMIT DROP;`)
  }
  for (const block of dump.copyBlocks) {
    const columns = block.columns.map(quoteIdentifier).join(', ')
    statements.push(`COPY pg_temp.${quoteIdentifier(`transfer_${block.table}`)} (${columns}) FROM stdin;`)
    statements.push(...block.data, '\\.')
  }
  for (const table of TRANSFER_TABLES) statements.push(`ALTER TABLE public.${quoteIdentifier(table)} DISABLE TRIGGER USER;`)
  for (const table of TRANSFER_TABLES) {
    const columns = manifest.columns[table].map(quoteIdentifier).join(', ')
    const overriding = table === 'audit_events' ? ' OVERRIDING SYSTEM VALUE' : ''
    statements.push(`INSERT INTO public.${quoteIdentifier(table)} (${columns})${overriding} SELECT ${columns} FROM pg_temp.${quoteIdentifier(`transfer_${table}`)};`)
  }
  statements.push(`ALTER SEQUENCE public.audit_events_id_seq RESTART WITH ${sequenceRestart(manifest)};`)
  for (const table of TRANSFER_TABLES) statements.push(`ALTER TABLE public.${quoteIdentifier(table)} ENABLE TRIGGER USER;`)

  const exactRows = TRANSFER_TABLES.map((table) => `
    IF EXISTS (
      (SELECT * FROM public.${quoteIdentifier(table)} EXCEPT ALL SELECT * FROM pg_temp.${quoteIdentifier(`transfer_${table}`)})
      UNION ALL
      (SELECT * FROM pg_temp.${quoteIdentifier(`transfer_${table}`)} EXCEPT ALL SELECT * FROM public.${quoteIdentifier(table)})
    ) THEN RAISE EXCEPTION 'full row comparison failed'; END IF;
    IF (SELECT count(*) FROM public.${quoteIdentifier(table)}) <> ${manifest.rowCounts[table]} THEN RAISE EXCEPTION 'row count check failed'; END IF;`)
  statements.push(`DO $transfer_verify$
DECLARE
  sequence_last_value bigint;
  sequence_is_called boolean;
BEGIN
  ${exactRows.join('\n')}
  SELECT last_value, is_called INTO sequence_last_value, sequence_is_called FROM public.audit_events_id_seq;
  IF sequence_last_value <> ${sequenceRestart(manifest)} OR sequence_is_called THEN RAISE EXCEPTION 'audit sequence restart failed'; END IF;
END
$transfer_verify$;`)
  for (const table of TRANSFER_TABLES) {
    statements.push(`DO $trigger_check$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.${table}'::regclass AND NOT tgisinternal AND tgenabled <> 'O') THEN RAISE EXCEPTION 'a user trigger is not enabled normally'; END IF; END $trigger_check$;`)
  }
  statements.push("DO $foreign_key_check$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE contype = 'f' AND connamespace IN ('public'::regnamespace, 'private'::regnamespace) AND NOT convalidated) THEN RAISE EXCEPTION 'an application foreign key is not validated'; END IF; END $foreign_key_check$;")
  statements.push('COMMIT;')
  return `${statements.join('\n')}\n`
}

export async function verifyArchiveFile(archivePath, manifest) {
  validateManifest(manifest)
  const archive = await readFile(archivePath)
  if (sha256(archive) !== manifest.archiveSha256) throw new Error('Transfer archive checksum does not match its private manifest.')
  return archive.length
}

export async function readRestoreSqlFromArchive(archivePath, { privateDirectory, pgBinDirectory, rehearsal = false }) {
  const resolvedDirectory = path.resolve(privateDirectory)
  const temporaryDirectory = rehearsal ? path.join(resolvedDirectory, 'rehearsal') : resolvedDirectory
  const name = `restore-${cryptoRandomId()}.sql`
  const outputPath = path.resolve(temporaryDirectory, name)
  if (path.dirname(outputPath) !== path.resolve(temporaryDirectory)) throw new Error('Temporary restore path escaped its private directory.')
  await stat(resolvedDirectory).catch(() => { throw new Error('Private transfer directory is missing.') })
  await stat(temporaryDirectory).catch(() => { throw new Error('Private rehearsal directory is missing.') })
  const realPrivateDirectory = await realpath(resolvedDirectory)
  const realTemporaryDirectory = await realpath(temporaryDirectory)
  if (
    (rehearsal && (path.dirname(realTemporaryDirectory) !== realPrivateDirectory || path.basename(realTemporaryDirectory) !== 'rehearsal'))
    || (!rehearsal && realTemporaryDirectory !== realPrivateDirectory)
  ) {
    throw new Error('Private restore directory is not inside its generated artifact directory.')
  }
  const ownedOutput = path.dirname(outputPath) === path.resolve(temporaryDirectory)
    && /^restore-[0-9a-f-]{36}\.sql$/.test(path.basename(outputPath))
  try {
    await runPostgresTool(path.join(pgBinDirectory, 'pg_restore.exe'), [
      '--data-only', '--no-owner', '--no-acl', '--file', outputPath, archivePath,
    ], { cwd: temporaryDirectory })
    const resolvedOutput = path.resolve(outputPath)
    const resolvedParent = await realpath(path.dirname(resolvedOutput))
    const expectedParent = await realpath(temporaryDirectory)
    const resolvedFile = await realpath(resolvedOutput)
    if (resolvedParent !== expectedParent || resolvedFile !== resolvedOutput || path.basename(resolvedOutput) !== name) {
      throw new Error('Temporary restore output path failed ownership validation.')
    }
    const fileInfo = await stat(resolvedOutput)
    if (!fileInfo.isFile() || fileInfo.size > maxSqlBytes) throw new Error('Temporary restore output is not a valid bounded SQL file.')
    return await readFile(resolvedOutput, 'utf8')
  } finally {
    if (ownedOutput) {
      const resolvedOutput = path.resolve(outputPath)
      try {
        const resolvedParent = await realpath(path.dirname(resolvedOutput))
        const expectedParent = await realpath(temporaryDirectory)
        if (resolvedParent === expectedParent && path.basename(resolvedOutput) === name) await unlink(resolvedOutput)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw new Error('Temporary restore file cleanup failed in its private directory.')
      }
    }
  }
}

function cryptoRandomId() {
  return randomUUID()
}

export function parseConnectionParts(connectionUrl) {
  const url = new URL(connectionUrl)
  return {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  }
}

function postgresChildEnvironment(connectionUrl, { tls = 'disable', caPath } = {}) {
  const parts = parseConnectionParts(connectionUrl)
  const env = { ...process.env, PGPASSWORD: parts.password, PGSSLMODE: tls }
  for (const name of [
    'PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE',
    'PGOPTIONS', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY',
  ]) delete env[name]
  if (caPath) env.PGSSLROOTCERT = caPath
  return { parts, env }
}

export async function createCustomArchive({ sourceUrl, destination, artifactDirectory, pgBinDirectory, synthetic = false }) {
  if (synthetic) validateSyntheticDatabaseUrl(sourceUrl)
  else validateManagedSourceUrl(sourceUrl)
  const privateRoot = path.resolve(artifactDirectory)
  const resolvedDestination = path.resolve(destination)
  if (path.dirname(resolvedDestination) !== privateRoot || !/^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump$/.test(path.basename(resolvedDestination))) {
    throw new Error('Backup path must be a generated file inside the private transfer directory.')
  }
  if (await realpath(privateRoot).then((resolved) => resolved !== privateRoot, () => true)) {
    throw new Error('Backup directory is not a canonical private artifact path.')
  }
  if (await stat(resolvedDestination).then(() => true, (error) => error?.code === 'ENOENT' ? false : Promise.reject(error))) {
    throw new Error('Backup destination already exists.')
  }
  const parts = parseConnectionParts(sourceUrl)
  const { env } = postgresChildEnvironment(sourceUrl)
  const args = [
    '--format=custom', '--data-only', '--no-owner', '--no-acl',
    ...TRANSFER_TABLES.map((table) => `--table=public.${table}`),
    '--host', parts.host,
    '--port', String(parts.port),
    '--username', parts.user,
    '--dbname', parts.database,
    '--file', resolvedDestination,
  ]
  let successful = false
  try {
    await runPostgresTool(path.join(pgBinDirectory, 'pg_dump.exe'), args, { cwd: privateRoot, env })
    const info = await stat(resolvedDestination)
    if (!info.isFile() || info.size === 0) throw new Error('Backup file was not created correctly.')
    successful = true
    return { archiveBytes: info.size }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Transfer')) throw error
    throw new Error('PostgreSQL could not create the private snapshot archive.')
  } finally {
    if (!successful) {
      const resolvedParent = path.resolve(path.dirname(resolvedDestination))
      if (resolvedParent === privateRoot && /^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump$/.test(path.basename(resolvedDestination))) {
        const destinationParent = await realpath(path.dirname(resolvedDestination)).catch(() => null)
        const file = await lstat(resolvedDestination).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
        if (destinationParent === privateRoot && file?.isFile()) await unlink(resolvedDestination)
      }
    }
  }
}

export async function loadManifest(manifestPath, artifactDirectory) {
  const root = path.resolve(artifactDirectory)
  const filePath = path.resolve(manifestPath)
  if (path.dirname(filePath) !== root || !/^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json$/.test(path.basename(filePath))) {
    throw new Error('Manifest must be a generated file inside the private transfer directory.')
  }
  if (await realpath(root).then((resolved) => resolved !== root, () => true)) {
    throw new Error('Manifest directory is not a canonical private artifact path.')
  }
  const manifestInfo = await lstat(filePath).catch(() => null)
  if (!manifestInfo?.isFile()) throw new Error('Transfer manifest must be a regular private artifact file.')
  if (await realpath(filePath).then((resolved) => path.dirname(resolved) !== root, () => true)) {
    throw new Error('Transfer manifest resolved outside its private directory.')
  }
  const manifest = JSON.parse(await readFile(filePath, 'utf8'))
  validateManifest(manifest)
  const expectedTargetMigrations = await expectedMigrationChecksums()
  const expectedSourceMigrations = await expectedSourceMigrationSets()
  if (
    !sameLedger(manifest.targetMigrations, expectedTargetMigrations)
    || !expectedSourceMigrations.some((expected) => sameLedger(manifest.sourceMigrations, expected))
  ) {
    throw new Error('Transfer manifest source or target migration checksums do not match an approved exact baseline.')
  }
  const archivePath = path.join(root, manifest.archiveName)
  if (path.dirname(path.resolve(archivePath)) !== root) throw new Error('Transfer archive path escaped its private directory.')
  const archiveInfo = await lstat(archivePath).catch(() => null)
  if (!archiveInfo?.isFile()) throw new Error('Transfer archive must be a regular private artifact file.')
  if (await realpath(archivePath).then((resolved) => path.dirname(resolved) !== root, () => true)) {
    throw new Error('Transfer archive resolved outside its private directory.')
  }
  await verifyArchiveFile(archivePath, manifest)
  return { manifest, archivePath, manifestPath: filePath }
}

function runPostgresTool(executable, args, { cwd, env = process.env, stdinText, captureStdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['pipe', captureStdout ? 'pipe' : 'ignore', 'pipe'],
    })
    const stdout = []
    let stdoutLength = 0
    let stderrLength = 0
    child.stdout?.on('data', (chunk) => {
      stdoutLength += chunk.length
      if (captureStdout) {
        stdout.push(chunk)
        if (stdoutLength > maxSqlBytes) child.kill()
      }
    })
    child.stderr?.on('data', (chunk) => { stderrLength += chunk.length })
    child.once('error', () => reject(new Error('PostgreSQL command could not be started.')))
    child.once('close', (code) => {
      if (code !== 0) {
        return reject(new Error('PostgreSQL command failed; detailed output was withheld.'))
      }
      resolve({ stdout: captureStdout ? Buffer.concat(stdout).toString('utf8') : '', stdoutLength, stderrLength })
    })
    if (stdinText !== undefined) child.stdin.end(stdinText)
    else child.stdin.end()
  })
}

export async function runPsqlRestore({ connectionUrl, script, kind, caPath, pgBinDirectory = 'C:\\Program Files\\PostgreSQL\\16\\bin' }) {
  const url = kind === 'cloud' ? validateCloudTargetUrl(connectionUrl) : validateSyntheticDatabaseUrl(connectionUrl)
  const { parts, env } = postgresChildEnvironment(connectionUrl, {
    tls: kind === 'cloud' ? 'verify-full' : 'disable',
    caPath: kind === 'cloud' ? caPath : undefined,
  })
  if (kind === 'cloud') {
    const ca = await readFile(caPath, 'utf8')
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('A valid Supabase database CA certificate is required for restore.')
    }
  }
  if (!url.hostname || !parts.user || !parts.password) throw new Error('Transfer target connection settings are invalid.')
  const args = [
    '--no-psqlrc', '--quiet', '--set=ON_ERROR_STOP=1',
    '--host', parts.host,
    '--port', String(parts.port),
    '--username', parts.user,
    '--dbname', parts.database,
  ]
  await runPostgresTool(path.join(pgBinDirectory, 'psql.exe'), args, { env, stdinText: script })
}

export function generatedSnapshotName(date = new Date(), suffix = cryptoRandomId()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `snapshot-${stamp}-${suffix}`
}

export function assertPrivateArtifactPath(filePath, privateDirectory, basenamePattern) {
  const root = path.resolve(privateDirectory)
  const resolved = path.resolve(filePath)
  if (path.dirname(resolved) !== root || !basenamePattern.test(path.basename(resolved))) {
    throw new Error('Artifact path failed private-directory ownership validation.')
  }
  return resolved
}
