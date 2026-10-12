import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { runMigrations } from '../server/database/migrate.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const clusterPath = path.join(dataRoot, 'postgres')
const metadataPath = path.join(dataRoot, 'local-db.json')
const direction = process.argv[2] ?? 'up'

function assertManagedTarget(url, user) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Managed local database URL is invalid.') }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.hostname !== '127.0.0.1'
    || parsed.port !== '55432'
    || parsed.pathname !== '/lab002_local'
    || decodeURIComponent(parsed.username) !== user
  ) {
    throw new Error('Database migrations may only use the managed loopback PostgreSQL 16 database.')
  }
}

function sameWindowsPath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

try {
  if (!['up', 'down'].includes(direction)) throw new Error('Usage: node scripts/db-migrate.mjs <up|down>')
  if (direction === 'down' && !process.argv.includes('--confirm-local-data-loss')) {
    throw new Error('Rollback removes the local schema. Repeat with --confirm-local-data-loss to confirm.')
  }
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (
    metadata.formatVersion !== 1
    || metadata.postgresMajor !== 16
    || metadata.port !== 55432
    || metadata.database !== 'lab002_local'
    || !sameWindowsPath(metadata.clusterPath, clusterPath)
  ) {
    throw new Error('Managed local database metadata is invalid.')
  }
  assertManagedTarget(metadata.migrationUrl, 'lab002_migrator')
  const database = postgres(metadata.migrationUrl, { max: 1, connect_timeout: 5 })
  try {
    const target = await database`
      select current_setting('server_version_num')::int as version_num,
             current_user as role_name,
             current_database() as database_name,
             inet_server_addr() = inet '127.0.0.1' as is_loopback,
             inet_server_port() as server_port
    `
    if (
      Math.floor(Number(target[0].version_num) / 10000) !== 16
      || target[0].role_name !== 'lab002_migrator'
      || target[0].database_name !== 'lab002_local'
      || !target[0].is_loopback
      || Number(target[0].server_port) !== 55432
    ) {
      throw new Error(`Managed PostgreSQL verification failed (major=${Math.floor(Number(target[0].version_num) / 10000)}, role=${target[0].role_name}, database=${target[0].database_name}, loopback=${target[0].is_loopback}, port=${target[0].server_port}).`)
    }
    const results = await runMigrations(database, direction)
    for (const result of results) {
      console.log(`${result.applied ? (direction === 'up' ? 'Applied' : 'Reverted') : 'Unchanged'} ${result.name}`)
    }
  } finally {
    await database.end({ timeout: 3 })
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration failed.')
  process.exitCode = 1
}
