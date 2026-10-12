import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const clusterPath = path.join(dataRoot, 'postgres')
const metadataPath = path.join(dataRoot, 'local-db.json')
const logPath = path.join(dataRoot, 'postgres.log')
const expectedPort = 55432
const pgCtl = 'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe'

function sameWindowsPath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function assertManagedProcess() {
  execFileSync(pgCtl, ['-D', clusterPath, 'status'], { stdio: 'ignore' })
}

function assertManagedUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Managed local database URL is invalid.') }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1'
    || url.port !== String(expectedPort)
    || url.pathname !== '/lab002_local'
    || decodeURIComponent(url.username) !== 'lab002_migrator'
  ) {
    throw new Error('Persistence smoke may only use the managed local PostgreSQL 16 database.')
  }
}

async function connectManaged(migrationUrl) {
  const database = postgres(migrationUrl, { max: 1, connect_timeout: 5 })
  try {
    const [server] = await database`
      select current_setting('server_version_num')::int as version_num,
             current_user as role_name,
             current_database() as database_name,
             inet_server_addr() = inet '127.0.0.1' as is_loopback,
             inet_server_port() as server_port
    `
    if (
      Math.floor(Number(server.version_num) / 10000) !== 16
      || server.role_name !== 'lab002_migrator'
      || server.database_name !== 'lab002_local'
      || !server.is_loopback
      || Number(server.server_port) !== expectedPort
    ) {
      throw new Error('Persistence smoke connected outside the managed local PostgreSQL 16 target.')
    }
    return database
  } catch (error) {
    await database.end({ timeout: 3 })
    throw error
  }
}

let database
let schemaCreated = false
let serverStopped = false
const marker = randomUUID()
const schema = `data_smoke_${marker.replaceAll('-', '')}`
const quotedSchema = `"${schema}"`

try {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (
    metadata.formatVersion !== 1
    || metadata.postgresMajor !== 16
    || metadata.port !== expectedPort
    || metadata.database !== 'lab002_local'
    || !sameWindowsPath(metadata.clusterPath, clusterPath)
  ) {
    throw new Error('Managed local database metadata is invalid.')
  }
  assertManagedUrl(metadata.migrationUrl)
  assertManagedProcess()

  database = await connectManaged(metadata.migrationUrl)
  await database.unsafe(`create schema ${quotedSchema}`).simple()
  schemaCreated = true
  await database.unsafe(`create table ${quotedSchema}.persistence_probe (marker uuid not null)`).simple()
  await database.unsafe(`insert into ${quotedSchema}.persistence_probe (marker) values ($1)`, [marker])
  await database.end({ timeout: 3 })
  database = undefined

  execFileSync(pgCtl, ['-D', clusterPath, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
  serverStopped = true
  execFileSync(pgCtl, ['-D', clusterPath, '-l', logPath, '-w', 'start'], { stdio: 'ignore' })
  serverStopped = false
  assertManagedProcess()

  database = await connectManaged(metadata.migrationUrl)
  const [persisted] = await database.unsafe(`select marker::text as marker from ${quotedSchema}.persistence_probe`)
  if (persisted?.marker !== marker) throw new Error('Synthetic persistence row did not survive the managed database restart.')
  await database.unsafe(`drop schema ${quotedSchema} cascade`).simple()
  schemaCreated = false
  console.log('Managed PostgreSQL 16 restarted successfully; the synthetic row persisted and its temporary schema was removed.')
} finally {
  if (database) await database.end({ timeout: 3 })
  if (serverStopped) {
    execFileSync(pgCtl, ['-D', clusterPath, '-l', logPath, '-w', 'start'], { stdio: 'ignore' })
    serverStopped = false
  }
  if (schemaCreated) {
    assertManagedProcess()
    database = await connectManaged(JSON.parse(await readFile(metadataPath, 'utf8')).migrationUrl)
    try {
      await database.unsafe(`drop schema if exists ${quotedSchema} cascade`).simple()
    } finally {
      await database.end({ timeout: 3 })
    }
  }
}
