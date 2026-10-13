import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertPrivateArtifactPath,
  buildManifest,
  buildRestoreSql,
  createCustomArchive,
  generatedSnapshotName,
  inspectSourceDatabase,
  inspectTargetDatabase,
  loadManifest,
  makeDatabaseClient,
  readRestoreSqlFromArchive,
  runPsqlRestore,
  validateCloudTargetUrl,
  validateManagedSourceUrl,
} from './cloud-data-transfer-core.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const transferRoot = path.join(dataRoot, 'cloud-transfer')
const rehearsalRoot = path.join(transferRoot, 'rehearsal')
const pgBinDirectory = 'C:\\Program Files\\PostgreSQL\\16\\bin'
const projectRef = 'jkiewjlohgmsujcwerpi'
const action = process.argv[2]
const projectFlag = process.argv.find((value) => value.startsWith('--project-ref='))
const manifestFlag = process.argv.find((value) => value.startsWith('--manifest='))
const confirmedImport = process.argv.includes('--confirm-import')

function fail(message) {
  throw new Error(message)
}

function requireNode24() {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    fail('This transfer tool requires the project Node.js 24 runtime.')
  }
}

function secureDirectory(directory) {
  if (process.platform !== 'win32') fail('Private transfer artifacts require the Windows workspace ACL helper.')
  const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const sid = identity.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) fail('Could not secure the private transfer directory.')
  execFileSync('icacls.exe', [
    directory,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:(OI)(CI)F`,
    '*S-1-5-18:(OI)(CI)F',
  ], { stdio: 'ignore', windowsHide: true })
}

async function ensurePrivateDirectories() {
  await mkdir(transferRoot, { recursive: true })
  const canonicalDataRoot = await realpath(dataRoot)
  const canonicalTransferRoot = await realpath(transferRoot)
  if (path.dirname(canonicalTransferRoot) !== canonicalDataRoot) fail('Private transfer directory must remain under the application data directory.')
  secureDirectory(transferRoot)
  await mkdir(rehearsalRoot, { recursive: true })
  const canonicalRehearsalRoot = await realpath(rehearsalRoot)
  if (path.dirname(canonicalRehearsalRoot) !== canonicalTransferRoot) fail('Private rehearsal directory must remain under the transfer directory.')
  secureDirectory(rehearsalRoot)
}

function totalRows(rowCounts) {
  return Object.values(rowCounts).reduce((total, count) => total + count, 0)
}

function requireProjectConfirmation() {
  if (projectFlag?.slice('--project-ref='.length) !== projectRef) {
    fail('Supply the approved --project-ref before checking or importing the cloud target.')
  }
}

function manifestPath() {
  const name = manifestFlag?.slice('--manifest='.length) ?? ''
  if (!/^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json$/.test(name)) {
    fail('Supply a generated --manifest filename from the private transfer directory.')
  }
  return assertPrivateArtifactPath(path.join(transferRoot, name), transferRoot, /^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json$/)
}

async function cloudConnection() {
  const connectionUrl = process.env.SUPABASE_MIGRATION_DATABASE_URL
  if (!connectionUrl) fail('Set the private SUPABASE_MIGRATION_DATABASE_URL to the dedicated project migration role.')
  validateCloudTargetUrl(connectionUrl)
  const caPath = process.env.SUPABASE_CA_CERT_PATH
  if (!caPath) fail('Set SUPABASE_CA_CERT_PATH to the approved Supabase root CA certificate.')
  const ca = await readFile(caPath, 'utf8')
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    fail('The configured Supabase CA certificate is invalid.')
  }
  return { connectionUrl, caPath, database: makeDatabaseClient(connectionUrl, { kind: 'cloud', caCertificate: ca }) }
}

async function prepareSnapshot() {
  await ensurePrivateDirectories()
  const sourceUrl = process.env.LAB002_TRANSFER_SOURCE_DATABASE_URL
  if (!sourceUrl) fail('Set the private LAB002_TRANSFER_SOURCE_DATABASE_URL to the managed local migration role.')
  validateManagedSourceUrl(sourceUrl)
  let database = makeDatabaseClient(sourceUrl)
  const name = generatedSnapshotName()
  const archivePath = assertPrivateArtifactPath(path.join(transferRoot, `${name}.dump`), transferRoot, /^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.dump$/)
  const manifestFile = assertPrivateArtifactPath(path.join(transferRoot, `${name}.json`), transferRoot, /^snapshot-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}\.json$/)
  let snapshotWritten = false
  let manifestWritten = false
  try {
    const source = await inspectSourceDatabase(database)
    await database.end({ timeout: 3 })
    database = null
    const backup = await createCustomArchive({
      sourceUrl,
      destination: archivePath,
      artifactDirectory: transferRoot,
      pgBinDirectory,
    })
    snapshotWritten = true
    database = makeDatabaseClient(sourceUrl)
    const sourceAfter = await inspectSourceDatabase(database)
    if (
      source.fingerprint !== sourceAfter.fingerprint
      || JSON.stringify(source.sourceMigrations) !== JSON.stringify(sourceAfter.sourceMigrations)
      || source.auditSequenceIncrement !== sourceAfter.auditSequenceIncrement
    ) {
      fail('Source schema or migration metadata changed while the snapshot was being prepared.')
    }
    const restoredSql = await readRestoreSqlFromArchive(archivePath, {
      privateDirectory: transferRoot,
      pgBinDirectory,
      rehearsal: true,
    })
    const manifest = await buildManifest({ archivePath, source: sourceAfter, restoredSql })
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    manifestWritten = true
    console.log(`Private snapshot ready: ${totalRows(manifest.rowCounts)} rows across the approved tables; ${backup.archiveBytes} bytes.`)
    console.log(`Manifest: ${path.relative(appRoot, manifestFile)}`)
  } finally {
    await database?.end({ timeout: 3 })
    if (!manifestWritten) {
      if (snapshotWritten) await unlink(archivePath).catch(() => {})
      await unlink(manifestFile).catch(() => {})
    }
  }
}

async function checkCloudTarget({ forImport = false } = {}) {
  requireProjectConfirmation()
  await ensurePrivateDirectories()
  const loaded = await loadManifest(manifestPath(), transferRoot)
  const { connectionUrl, database, caPath } = await cloudConnection()
  try {
    await inspectTargetDatabase(database, loaded.manifest, { kind: 'cloud' })
  } finally {
    await database.end({ timeout: 3 })
  }
  if (!forImport) {
    console.log(`Cloud target passed read-only checks and is empty. Verified snapshot aggregate: ${totalRows(loaded.manifest.rowCounts)} rows.`)
    return
  }
  if (!confirmedImport) fail('Cloud data transfer requires --confirm-import after a reviewed target check.')
  const restoredSql = await readRestoreSqlFromArchive(loaded.archivePath, {
    privateDirectory: transferRoot,
    pgBinDirectory,
    rehearsal: true,
  })
  const script = buildRestoreSql(restoredSql, loaded.manifest, { kind: 'cloud' })
  await runPsqlRestore({ connectionUrl, script, kind: 'cloud', caPath, pgBinDirectory })
  console.log(`Cloud import transaction completed. The snapshot contained ${totalRows(loaded.manifest.rowCounts)} rows across the approved tables.`)
}

try {
  requireNode24()
  if (action === 'prepare') await prepareSnapshot()
  else if (action === 'check') await checkCloudTarget()
  else if (action === 'import') await checkCloudTarget({ forImport: true })
  else fail('Usage: node scripts/cloud-data-transfer.mjs <prepare|check|import> [--manifest=snapshot-....json] [--project-ref=jkiewjlohgmsujcwerpi] [--confirm-import]')
} catch (error) {
  const safeMessage = error instanceof Error ? error.message : ''
  const allowlisted = [
    'This transfer tool requires the project Node.js 24 runtime.',
    'Private transfer artifacts require the Windows workspace ACL helper.',
    'Could not secure the private transfer directory.',
    'Supply the approved --project-ref before checking or importing the cloud target.',
    'Supply a generated --manifest filename from the private transfer directory.',
    'Set the private SUPABASE_MIGRATION_DATABASE_URL to the dedicated project migration role.',
    'Set SUPABASE_CA_CERT_PATH to the approved Supabase root CA certificate.',
    'The configured Supabase CA certificate is invalid.',
    'Set the private LAB002_TRANSFER_SOURCE_DATABASE_URL to the managed local migration role.',
    'Cloud data transfer requires --confirm-import after a reviewed target check.',
  ]
  if (allowlisted.includes(safeMessage) || safeMessage.startsWith('Database ') || safeMessage.startsWith('Transfer ') || safeMessage.startsWith('Cloud target')) {
    console.error(safeMessage)
  } else {
    console.error('Cloud data transfer stopped; sensitive connection and database details were suppressed.')
  }
  process.exitCode = 1
}
