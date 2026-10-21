import { readdir, lstat, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { resetTeacherAccountPassword } from '../server/auth/account-admin.ts'
import { LocalSchoolLogoStorage } from '../server/utils/school-logo-storage.ts'
import { APP_ROOT, TEST_ROOT, BACKUP_ROOT, LIMITS, directory, privateAcl, ownedDirectory, verifyOwned, cleanup, publish, writePrivate, readPrivate, strictJson, sha256, fail, inside } from './local-backup-files.mjs'
import { connect, pgTool, connectionArgs, newCluster, verifyCluster, clusterConnection, destroyCluster, secret } from './local-backup-postgres.mjs'
import { beginManagedIdentity, verifyManagedIdentity } from './local-backup-managed-identity.mjs'

export const TABLES = Object.freeze(['teacher_accounts', 'schools', 'school_classes', 'semesters', 'students', 'semester_memberships', 'school_calendar_rules', 'calendar_exceptions', 'attendance_records', 'semester_archive_snapshots', 'audit_events', 'school_logo_assets'])
const insertOrder = ['teacher_accounts', 'schools', 'school_classes', 'school_logo_assets', 'semesters', 'students', 'semester_memberships', 'school_calendar_rules', 'calendar_exceptions', 'attendance_records', 'semester_archive_snapshots', 'audit_events']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const hash = /^[a-f0-9]{64}$/
const backupId = /^backup-\d{8}T\d{6}Z-[0-9a-f-]{36}$/
const sources = new WeakMap()
const json = (value) => `${JSON.stringify(value)}\n`
const identifier = (name) => { if (!/^[a-z_][a-z0-9_]*$/.test(name)) fail('identifier'); return `"${name}"` }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const keys = (object, names) => { if (!object || typeof object !== 'object' || Array.isArray(object) || !equal(Object.keys(object).sort(), [...names].sort())) fail('descriptor') }
function checkSignal(signal) { if (signal.aborted) fail('overall-timeout') }
export async function migrationChecksums() {
  const root = path.join(APP_ROOT, 'server', 'database', 'migrations')
  const names = (await readdir(root)).filter((name) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name)).sort()
  if (names.length !== 8 || !names[7].startsWith('0008_')) fail('migration-version')
  const entries = []
  for (const name of names) {
    const up = await readFile(path.join(root, name), 'utf8')
    const down = await readFile(path.join(root, name.replace('.up.sql', '.down.sql')), 'utf8')
    entries.push({ name: name.replace('.up.sql', ''), checksum: sha256(`${up}\0${down}`) })
  }
  return entries
}
export async function schemaDescriptor(db) {
  const rows = await db`select c.relname as table_name, a.attname as column_name, pg_catalog.format_type(a.atttypid,a.atttypmod) as type, a.attnotnull as required, a.attidentity as identity, a.attgenerated as generated from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relname=any(${db.array(TABLES)}) and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`
  const tables = {}
  for (const name of TABLES) {
    tables[name] = rows.filter((row) => row.table_name === name).map(({ table_name, ...column }) => column)
    if (!tables[name].length) fail('missing-table')
  }
  return tables
}
async function ledger(db) { return Array.from(await db`select name,checksum from public.schema_migrations order by name`, (row) => ({ name: row.name, checksum: row.checksum })) }
async function verifyLedger(db) { if (!equal(await ledger(db), await migrationChecksums())) fail('migration-ledger') }
async function tableDigests(db) {
  const result = {}
  for (const table of TABLES) {
    const rows = await db.unsafe(`select row_to_json(t)::text as row from public.${identifier(table)} t order by row_to_json(t)::text COLLATE "C"`)
    result[table] = { count: rows.length, sha256: sha256(rows.map((row) => row.row).join('\n')) }
  }
  return result
}
export async function fixtureSource(capability, { identityGuard = false } = {}) {
  const state = await verifyCluster(capability)
  const logos = path.join(state.receipt.path, 'logos')
  await mkdir(logos, { recursive: true })
  const source = Object.freeze({})
  sources.set(source, { kind: 'fixture', capability, logos, backupRoot: path.join(state.receipt.path, 'backups'), identityPolicy: identityGuard ? { root: state.dataDirectory, port: state.port, database: 'lab002_test', role: 'lab002_migrator', fixtureConfig: path.join(state.dataDirectory,'backup-config.conf') } : null })
  return source
}
export async function managedSource() {
  const data = strictJson(await readPrivate(path.join(APP_ROOT, '.data', 'local-db.json'), LIMITS.manifest))
  const cluster = path.join(APP_ROOT, '.data', 'postgres')
  await directory(cluster)
  const url = new URL(data.migrationUrl)
  if (data.formatVersion !== 1 || data.postgresMajor !== 16 || data.port !== 55432 || data.database !== 'lab002_local' || path.resolve(data.clusterPath) !== cluster || url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/lab002_local' || decodeURIComponent(url.username) !== 'lab002_migrator') fail('managed-source')
  connectionArgs(data.migrationUrl)
  await pgTool('pg_ctl', ['-D', cluster, 'status'])
  const source = Object.freeze({})
  sources.set(source, { kind: 'managed', url: data.migrationUrl, cluster, logos: path.join(APP_ROOT, '.data', 'uploads', 'school-logos'), backupRoot: BACKUP_ROOT, identityPolicy: { root: cluster, port: 55432, database: 'lab002_local', role: 'lab002_migrator' } })
  return source
}
async function sourceDetails(source) {
  const state = sources.get(source)
  if (!state) fail('source-capability')
  if (state.kind === 'fixture') return { ...state, url: await clusterConnection(state.capability) }
  // SQL identity is checked on the reserved exporter, before any business read.
  return state
}
export async function fixturePaths(source) { const state = sources.get(source); if (state?.kind !== 'fixture') fail('fixture'); return { logos: state.logos, backups: state.backupRoot } }

export function parseDump(bytes, schema) {
  if (bytes.length > LIMITS.sql) fail('SQL-limit')
  const lines = bytes.toString('utf8').split(/\r?\n/)
  const blocks = {}; let sequence
  const settings = new Set(["SET statement_timeout = 0;", "SET lock_timeout = 0;", "SET idle_in_transaction_session_timeout = 0;", "SET client_encoding = 'UTF8';", "SET standard_conforming_strings = on;", "SET check_function_bodies = false;", "SET xmloption = content;", "SET client_min_messages = warning;", "SET row_security = off;", "SELECT pg_catalog.set_config('search_path', '', false);"])
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line || line.startsWith('--') || settings.has(line) || /^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line)) continue
    const copy = line.match(/^COPY public\.([a-z_][a-z0-9_]*) \(([a-z0-9_", ]+)\) FROM stdin;$/)
    if (copy) {
      const table = copy[1]
      const columns = copy[2].split(',').map((column) => column.trim().replace(/^"([a-z_][a-z0-9_]*)"$/, '$1'))
      if (!TABLES.includes(table) || blocks[table] || !equal(columns, schema[table].map((column) => column.column_name))) fail('COPY-descriptor')
      const data = []; let complete = false
      while (++index < lines.length) {
        if (lines[index] === '\\.') { complete = true; break }
        const row = lines[index]
        if (row.split('\t').length !== columns.length || row.includes('\0') || row.startsWith('\\')) fail('COPY-row')
        data.push(row)
      }
      if (!complete) fail('COPY-truncated')
      blocks[table] = { columns, data }; continue
    }
    const match = line.match(/^SELECT pg_catalog\.setval\('public\.audit_events_id_seq', ([0-9]+), (true|false)\);$/)
    if (match) {
      if (sequence || BigInt(match[1]) < 1n || BigInt(match[1]) >= 9223372036854775807n) fail('sequence')
      sequence = { value: match[1], called: match[2] === 'true' }; continue
    }
    fail('archive-SQL')
  }
  if (!sequence || TABLES.some((table) => !blocks[table])) fail('archive-incomplete')
  return { blocks, sequence }
}
async function extracted(archive, receipt, signal) {
  checkSignal(signal); await verifyOwned(receipt)
  // Never connect pg_restore to a database: only inspect its data as bounded text.
  return pgTool('pg_restore', ['--data-only', '--no-owner', '--no-acl', '--file=-', archive], { max: LIMITS.sql, signal })
}
function assetDescriptor(row) {
  return { id: row.id, schoolId: row.school_id, mimeType: row.mime_type, byteSize: row.byte_size, width: row.width, height: row.height, sha256: row.sha256, path: `assets/${row.id}.${row.mime_type === 'image/png' ? 'png' : 'jpg'}` }
}
async function validateImage(bytes, asset) {
  if (bytes.length !== asset.byteSize || bytes.length < 1 || bytes.length > LIMITS.logo || sha256(bytes) !== asset.sha256) fail('logo-hash')
  try {
    const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== (asset.mimeType === 'image/png' ? 'png' : 'jpeg') || metadata.width !== asset.width || metadata.height !== asset.height || (metadata.pages ?? 1) !== 1) fail('logo-metadata')
    await image.raw().toBuffer()
  } catch { fail('logo-decode') }
}
export async function createBackup(source, { afterSnapshot, beforePublish, signal = AbortSignal.timeout(300000) } = {}) {
  checkSignal(signal)
  const started = Date.now()
  const state = await sourceDetails(source)
  await directory(state.backupRoot, true)
  // Only this specific new backup directory; never change .data or upload ACLs.
  privateAcl(state.backupRoot)
  const receipt = await ownedDirectory(state.backupRoot, 'pending')
  let disconnected = false, failed = false
  const db = connect(state.url, { onclose: () => { disconnected = true } })
  let session, reserved, managedIdentity
  const abort=()=>{db.end({timeout:0}).catch(()=>{})}
  signal.addEventListener('abort',abort,{once:true})
  try {
    reserved = await db.reserve()
    // postgres reserve() can still queue writes after its socket has closed.
    // Refuse a dead exporter before touching that handler; never reconnect it.
    const live = () => { if (disconnected) fail('exporter-disconnected') }
    session = (strings, ...values) => { live(); return reserved(strings, ...values) }
    session.unsafe = (...args) => { live(); return reserved.unsafe(...args) }
    session.array = (...args) => { live(); return reserved.array(...args) }
    await session.unsafe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const tx = session
    const manifest = await (async () => {
      await tx`set local statement_timeout='120s'`
      await tx`set local lock_timeout='5s'`
      await tx`set local idle_in_transaction_session_timeout='300s'`
      if (state.identityPolicy) managedIdentity = await beginManagedIdentity(tx, state.identityPolicy, signal)
      await verifyLedger(tx)
      const schema = await schemaDescriptor(tx)
      const [snapshot] = await tx`select pg_export_snapshot() as id`
      const rows = await tx`select * from public.school_logo_assets order by id`
      const assets = rows.map(assetDescriptor)
      const active = Array.from(await tx`select id as school_id,active_logo_asset_id as asset_id from public.schools where active_logo_asset_id is not null order by id`)
      const archived = Array.from(await tx`select semester_id,logo_asset_id as asset_id from public.semester_archive_snapshots where logo_asset_id is not null order by semester_id`)
      const digests = await tableDigests(tx)
      if (assets.length > LIMITS.assetCount || assets.reduce((n, item) => n + item.byteSize, 0) > LIMITS.assets) fail('asset-limit')
      await afterSnapshot?.()
      checkSignal(signal)
      const archive = path.join(receipt.path, 'database.dump')
      const connection = connectionArgs(state.url)
      if (managedIdentity) await verifyManagedIdentity(managedIdentity, tx, signal)
      const dump = await pgTool('pg_dump', ['--format=custom', '--data-only', '--no-owner', '--no-acl', `--snapshot=${snapshot.id}`, '--lock-wait-timeout=5000', ...TABLES.map((table) => `--table=public.${table}`), ...connection.args], { env: connection.env, max: LIMITS.dump, signal })
      if (managedIdentity) await verifyManagedIdentity(managedIdentity, tx, signal)
      await writePrivate(archive, dump)
      parseDump(await extracted(archive, receipt, signal), schema)
      await mkdir(path.join(receipt.path, 'assets'))
      const storage = new LocalSchoolLogoStorage(state.logos)
      for (const asset of assets) {
        checkSignal(signal)
        if (!uuid.test(asset.id)) fail('asset-ID')
        const regular = await readPrivate(path.join(state.logos,path.basename(asset.path)),LIMITS.logo)
        const bytes = await storage.read(asset.id, asset.mimeType)
        if (!bytes.equals(regular)) fail('source-file-race')
        await validateImage(bytes, asset)
        await writePrivate(path.join(receipt.path, asset.path), bytes)
      }
      return { kind: 'lab002-local-backup', formatVersion: 1, postgresMajor: 16, createdAt: new Date().toISOString(), migrations: await ledger(tx), schema, authPolicy: 'reset-on-rehearsal-v1', dump: { path: 'database.dump', byteSize: dump.length, sha256: sha256(dump) }, assets, active, archived, tables: digests }
    })()
    // The exporter remains alive through dump and asset reads. Keep the same
    // reserved backend after COMMIT so final checks use a fresh catalog snapshot.
    await session.unsafe('COMMIT')
    await session.unsafe('BEGIN READ ONLY')
    await session`set local statement_timeout='120s'`
    await session`set local lock_timeout='5s'`
    await verifyLedger(session)
    if (!equal(manifest.schema, await schemaDescriptor(session))) fail('schema-changed')
    const manifestBytes = Buffer.from(json(manifest))
    if (manifestBytes.length > LIMITS.manifest) fail('manifest-limit')
    await writePrivate(path.join(receipt.path, 'manifest.json'), manifestBytes)
    await writePrivate(path.join(receipt.path, 'manifest.sha256'), `${sha256(manifestBytes)}\n`)
    await beforePublish?.(receipt.path)
    await validatePackage(receipt.path)
    checkSignal(signal)
    if (managedIdentity) await verifyManagedIdentity(managedIdentity, session, signal)
    await session.unsafe('COMMIT')
    const stamp = new Date().toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}/, '')
    const id = `backup-${stamp}-${randomUUID()}`
    await publish(receipt, id)
    return { id, durationMs: Date.now() - started, tables: TABLES.length, assets: manifest.assets.length, bytes: manifest.dump.byteSize }
  } catch (error) { failed = true; await cleanup(receipt); throw error } finally {
    // These transactions are read-only. Destroying our failed connection rolls
    // them back without issuing SQL/release on a potentially dead reservation.
    if (!failed && !disconnected) reserved?.release()
    signal.removeEventListener('abort',abort); await db.end({ timeout: failed || disconnected ? 0 : 3 })
  }
}

export async function validatePackage(root) {
  await directory(root)
  const raw = await readPrivate(path.join(root, 'manifest.json'), LIMITS.manifest)
  if ((await readPrivate(path.join(root, 'manifest.sha256'), 65)).toString() !== `${sha256(raw)}\n`) fail('manifest-hash')
  const m = strictJson(raw)
  keys(m, ['kind', 'formatVersion', 'postgresMajor', 'createdAt', 'migrations', 'schema', 'authPolicy', 'dump', 'assets', 'active', 'archived', 'tables'])
  if (m.kind !== 'lab002-local-backup' || m.formatVersion !== 1 || m.postgresMajor !== 16 || m.authPolicy !== 'reset-on-rehearsal-v1' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.createdAt) || !equal(m.migrations, await migrationChecksums())) fail('manifest-version')
  keys(m.schema, TABLES); keys(m.tables, TABLES)
  for (const table of TABLES) {
    if (!Array.isArray(m.schema[table]) || !m.schema[table].length) fail('schema')
    const seen = new Set()
    for (const column of m.schema[table]) {
      keys(column, ['column_name', 'type', 'required', 'identity', 'generated'])
      identifier(column.column_name)
      if (seen.has(column.column_name) || typeof column.type !== 'string' || typeof column.required !== 'boolean' || !['', 'a', 'd'].includes(column.identity) || !['', 's'].includes(column.generated)) fail('schema-column')
      seen.add(column.column_name)
    }
    keys(m.tables[table], ['count', 'sha256'])
    if (!Number.isSafeInteger(m.tables[table].count) || m.tables[table].count < 0 || !hash.test(m.tables[table].sha256)) fail('table-digest')
  }
  keys(m.dump, ['path', 'byteSize', 'sha256'])
  if (m.dump.path !== 'database.dump' || !Number.isSafeInteger(m.dump.byteSize) || m.dump.byteSize < 1 || m.dump.byteSize > LIMITS.dump || !hash.test(m.dump.sha256)) fail('dump-descriptor')
  const dump = await readPrivate(path.join(root, 'database.dump'), LIMITS.dump)
  if (dump.length !== m.dump.byteSize || sha256(dump) !== m.dump.sha256) fail('dump-hash')
  if (!Array.isArray(m.assets) || m.assets.length > LIMITS.assetCount || !Array.isArray(m.active) || !Array.isArray(m.archived)) fail('assets-descriptor')
  const ids = new Set(); let total = 0
  const imageBytes = new Map()
  for (const a of m.assets) {
    keys(a, ['id', 'schoolId', 'mimeType', 'byteSize', 'width', 'height', 'sha256', 'path'])
    if (!uuid.test(a.id) || !uuid.test(a.schoolId) || ids.has(a.id) || !['image/png', 'image/jpeg'].includes(a.mimeType) || a.path !== `assets/${a.id}.${a.mimeType === 'image/png' ? 'png' : 'jpg'}` || !Number.isInteger(a.byteSize) || a.byteSize < 1 || a.byteSize > LIMITS.logo || ![a.width,a.height].every((v) => Number.isInteger(v) && v > 0 && v <= 4096) || !hash.test(a.sha256)) fail('asset-descriptor')
    ids.add(a.id); total += a.byteSize
    if (total > LIMITS.assets) fail('asset-total')
    const bytes = await readPrivate(path.join(root, a.path), LIMITS.logo)
    await validateImage(bytes, a); imageBytes.set(a.id, bytes)
  }
  for (const [list, field] of [[m.active, 'school_id'], [m.archived, 'semester_id']]) {
    const seen = new Set()
    for (const ref of list) {
      keys(ref, [field, 'asset_id'])
      if (!uuid.test(ref[field]) || !ids.has(ref.asset_id) || seen.has(ref[field])) fail('reference'); seen.add(ref[field])
      if (field === 'school_id' && m.assets.find((a) => a.id === ref.asset_id).schoolId !== ref.school_id) fail('reference-owner')
    }
  }
  if (!equal((await readdir(root)).sort(), ['assets', 'database.dump', 'manifest.json', 'manifest.sha256'].sort())) fail('extra-file')
  await directory(path.join(root, 'assets'))
  if (!equal((await readdir(path.join(root, 'assets'))).sort(), m.assets.map((a) => path.basename(a.path)).sort())) fail('extra-asset')
  return { manifest: m, dump, images: imageBytes, raw }
}

export function buildRestoreSql(parsed, schema) {
  const sql = ['BEGIN;', "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='120s';"]
  for (const table of TABLES) sql.push(`CREATE TEMP TABLE ${identifier(`restore_${table}`)} (LIKE public.${identifier(table)} INCLUDING GENERATED INCLUDING IDENTITY) ON COMMIT DROP;`)
  for (const table of TABLES) { const b = parsed.blocks[table]; sql.push(`COPY pg_temp.${identifier(`restore_${table}`)} (${b.columns.map(identifier).join(',')}) FROM stdin;`, ...b.data, '\\.') }
  for (const table of TABLES) sql.push(`ALTER TABLE public.${identifier(table)} DISABLE TRIGGER USER;`)
  for (const table of insertOrder) {
    const columns = parsed.blocks[table].columns
    const select = columns.map((c) => table === 'schools' && c === 'active_logo_asset_id' ? 'NULL' : identifier(c)).join(',')
    sql.push(`INSERT INTO public.${identifier(table)} (${columns.map(identifier).join(',')})${table === 'audit_events' ? ' OVERRIDING SYSTEM VALUE' : ''} SELECT ${select} FROM pg_temp.${identifier(`restore_${table}`)};`)
  }
  sql.push('UPDATE public.schools s SET active_logo_asset_id=t.active_logo_asset_id FROM pg_temp.restore_schools t WHERE s.id=t.id;')
  for (const table of TABLES) {
    sql.push(`DO $verify$ BEGIN IF EXISTS((SELECT * FROM public.${identifier(table)} EXCEPT ALL SELECT * FROM pg_temp.${identifier(`restore_${table}`)}) UNION ALL (SELECT * FROM pg_temp.${identifier(`restore_${table}`)} EXCEPT ALL SELECT * FROM public.${identifier(table)})) THEN RAISE EXCEPTION 'restore row mismatch'; END IF; END $verify$;`)
    sql.push(`ALTER TABLE public.${identifier(table)} ENABLE TRIGGER USER;`)
  }
  const next = BigInt(parsed.sequence.value) + (parsed.sequence.called ? 1n : 0n)
  sql.push(`SELECT pg_catalog.setval('public.audit_events_id_seq',GREATEST(${next}::bigint,(SELECT COALESCE(max(id),0)+1 FROM public.audit_events)),false);`)
  sql.push(INVARIANT_SQL, 'COMMIT;')
  return sql.join('\n') + '\n'
}

const INVARIANT_SQL = `DO $invariants$ BEGIN
IF (SELECT count(*) FROM public.teacher_accounts) <> 1 OR (SELECT count(*) FROM public.schools) > 1 OR (SELECT count(*) FROM public.school_classes) > 1 THEN RAISE EXCEPTION 'owner invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.schools s WHERE NOT EXISTS(SELECT 1 FROM pg_timezone_names t WHERE t.name=s.time_zone)) THEN RAISE EXCEPTION 'timezone invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.semesters a JOIN public.semesters b ON a.school_id=b.school_id AND a.id<b.id AND a.starts_on<=b.ends_on AND b.starts_on<=a.ends_on) OR EXISTS(SELECT school_id FROM public.semesters WHERE status='active' GROUP BY school_id HAVING count(*)>1) THEN RAISE EXCEPTION 'semester invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.semesters s LEFT JOIN public.semester_archive_snapshots a ON a.semester_id=s.id WHERE (s.status='closed' AND a.semester_id IS NULL) OR (s.status='active' AND a.semester_id IS NOT NULL) OR (a.semester_id IS NOT NULL AND (a.academic_year<>s.academic_year OR a.term<>s.term OR a.starts_on<>s.starts_on OR a.ends_on<>s.ends_on))) THEN RAISE EXCEPTION 'archive invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.semester_archive_snapshots a JOIN public.semesters s ON s.id=a.semester_id JOIN public.school_logo_assets l ON l.id=a.logo_asset_id WHERE l.school_id<>s.school_id) THEN RAISE EXCEPTION 'archive owner invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.semester_memberships m JOIN public.semesters s ON s.id=m.semester_id WHERE m.school_id<>s.school_id OR m.starts_on<s.starts_on OR m.starts_on>s.ends_on OR m.ends_on>s.ends_on) THEN RAISE EXCEPTION 'membership invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.attendance_records a JOIN public.semester_memberships m ON m.id=a.membership_id JOIN public.semesters s ON s.id=a.semester_id WHERE m.semester_id<>a.semester_id OR a.attendance_date<s.starts_on OR a.attendance_date>s.ends_on OR a.attendance_date<m.starts_on OR a.attendance_date>m.ends_on OR a.attendance_date>public.school_local_today(m.school_id) OR (a.is_effective AND NOT public.is_school_day(m.school_id,a.attendance_date))) THEN RAISE EXCEPTION 'attendance invariant'; END IF;
IF EXISTS(SELECT 1 FROM public.attendance_records a JOIN public.semester_memberships m ON m.id=a.membership_id JOIN public.calendar_exceptions e ON e.id=a.excluded_by_calendar_exception_id WHERE e.school_id<>m.school_id OR e.exception_date<>a.attendance_date) THEN RAISE EXCEPTION 'exclusion invariant'; END IF;
IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private') AND t.tgenabled<>'O') OR EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('public','private') AND c.contype='f' AND NOT c.convalidated) THEN RAISE EXCEPTION 'guards invariant'; END IF;
END $invariants$;`

export async function restoreTest({ id, source, observe, signal = AbortSignal.timeout(300000) } = {}) {
  checkSignal(signal)
  if (!backupId.test(id ?? '')) fail('backup-ID')
  const state = source ? await sourceDetails(source) : { backupRoot: BACKUP_ROOT }
  // Validate all package bytes, metadata, names and SQL before creating a database target.
  const sourceRoot = path.join(state.backupRoot, id)
  const loaded = await validatePackage(sourceRoot)
  const work = await ownedDirectory(TEST_ROOT, 'restore')
  let cap
  const started = Date.now()
  try {
    await writePrivate(path.join(work.path, 'database.dump'), loaded.dump)
    const parsed = parseDump(await extracted(path.join(work.path, 'database.dump'), work, signal), loaded.manifest.schema)
    for (const table of TABLES) if (parsed.blocks[table].data.length!==loaded.manifest.tables[table].count) fail('archive-count')
    cap = await newCluster()
    const url = await clusterConnection(cap)
    const db = connect(url)
    const abort=()=>{db.end({timeout:0}).catch(()=>{})}
    signal.addEventListener('abort',abort,{once:true})
    try {
      checkSignal(signal)
      await runMigrations(db)
      const schema = await schemaDescriptor(db)
      if (!equal(schema, loaded.manifest.schema)) fail('schema-compatibility')
      await verifyCluster(cap)
      const security = await securityDescriptor(db)
      const connection = connectionArgs(url)
      await pgTool('psql', ['--no-psqlrc', '--set=ON_ERROR_STOP=1', ...connection.args], { env: connection.env, input: buildRestoreSql(parsed, schema), max: 1024 ** 2, signal })
      if (!equal(await tableDigests(db), loaded.manifest.tables)) fail('table-comparison')
      if (!equal(await securityDescriptor(db), security)) fail('security-comparison')
      const rows = await db`select * from public.school_logo_assets order by id`
      if (!equal(rows.map(assetDescriptor), loaded.manifest.assets)) fail('asset-metadata-comparison')
      const active = Array.from(await db`select id as school_id,active_logo_asset_id as asset_id from public.schools where active_logo_asset_id is not null order by id`)
      const archived = Array.from(await db`select semester_id,logo_asset_id as asset_id from public.semester_archive_snapshots where logo_asset_id is not null order by semester_id`)
      if (!equal(active, loaded.manifest.active) || !equal(archived, loaded.manifest.archived)) fail('reference-comparison')
      const cluster = await verifyCluster(cap)
      const logos = path.join(cluster.receipt.path, 'logos')
      await mkdir(logos)
      for (const asset of loaded.manifest.assets) {
        checkSignal(signal)
        const bytes = loaded.images.get(asset.id)
        await validateImage(bytes, asset)
        await writePrivate(path.join(logos, `${asset.id}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`), bytes)
        const restored = await new LocalSchoolLogoStorage(logos).read(asset.id, asset.mimeType)
        if (!restored.equals(bytes)) fail('logo-comparison')
      }
      await observe?.({ phase: 'before-reset', db, capability: cap, logos })
      await verifyCluster(cap)
      const before = await tableDigests(db)
      const [account] = await db`select id,email,password_hash,session_version from public.teacher_accounts`
      const password = secret()
      const hasher = new Scrypt({})
      const newHash = await hasher.make(password)
      await resetTeacherAccountPassword(db, newHash)
      const [changed] = await db`select id,email,password_hash,session_version from public.teacher_accounts`
      const after = await tableDigests(db)
      if (changed.id !== account.id || changed.email !== account.email || changed.session_version !== account.session_version + 1 || changed.password_hash === account.password_hash || !await hasher.verify(changed.password_hash,password)) fail('reset-account')
      for (const table of TABLES.filter((t) => !['teacher_accounts','audit_events'].includes(t))) if (!equal(before[table],after[table])) fail('reset-business-delta')
      if (after.audit_events.count !== before.audit_events.count + 1) fail('reset-audit-count')
      const [audit] = await db`select * from audit_events order by id desc limit 1`
      if (audit.actor_teacher_id !== account.id || audit.entity_type !== 'teacher_accounts' || audit.old_value?.session_version !== account.session_version || audit.new_value?.session_version !== changed.session_version || JSON.stringify(audit).includes(newHash)) fail('reset-audit-delta')
      const prefix = await db`select row_to_json(t)::text as row from public.audit_events t where id<>${audit.id} order by row_to_json(t)::text COLLATE "C"`
      if (sha256(prefix.map((row)=>row.row).join('\n'))!==before.audit_events.sha256) fail('reset-audit-prefix')
      const [sessions] = await db`select (select count(*)::int from teacher_sessions) as sessions,(select count(*)::int from private.login_throttle_attempts) as throttle`
      if (sessions.sessions !== 0 || sessions.throttle !== 0) fail('reset-sessions')
      await observe?.({ phase: 'after-reset', db, capability: cap, logos, password, oldAccount: account })
      checkSignal(signal)
      return { durationMs: Date.now()-started, tables: TABLES.length, assets: loaded.manifest.assets.length, reset: true, compared: true }
    } finally { signal.removeEventListener('abort',abort); await db.end({ timeout: 3 }) }
  } finally {
    if (cap) await destroyCluster(cap)
    await cleanup(work)
  }
}
async function securityDescriptor(db) {
  return {
    tables: Array.from(await db`select n.nspname,c.relname,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by n.nspname,c.relname`),
    triggers: Array.from(await db`select n.nspname,c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') order by n.nspname,c.relname,t.tgname`),
  }
}
