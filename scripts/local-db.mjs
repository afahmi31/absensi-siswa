import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(appRoot, '.data')
const clusterPath = path.join(dataRoot, 'postgres')
const metadataPath = path.join(dataRoot, 'local-db.json')
const envPath = path.join(dataRoot, 'local-env.ps1')
const databaseName = 'lab002_local'
const port = 55432
const expectedMajor = 16
const pgBin = 'C:\\Program Files\\PostgreSQL\\16\\bin'

function executable(name) {
  const target = path.join(pgBin, `${name}.exe`)
  try {
    execFileSync(target, ['--version'], { stdio: 'ignore' })
  } catch {
    throw new Error(`PostgreSQL ${expectedMajor} binary not available at ${pgBin}`)
  }
  return target
}

function run(name, args, options = {}) {
  const target = executable(name)
  return execFileSync(target, args, { stdio: 'inherit', ...options })
}

function windowsSid() {
  const value = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' }).trim()
  const sid = value.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) throw new Error('Could not determine the current Windows user SID.')
  return sid
}

async function lockDataDirectory() {
  await mkdir(dataRoot, { recursive: true })
  const sid = windowsSid()
  execFileSync('icacls.exe', [
    dataRoot,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:(OI)(CI)F`,
    '*S-1-5-18:(OI)(CI)F',
  ], { stdio: 'ignore' })
}

function randomPassword() {
  return randomBytes(32).toString('hex')
}

function databaseUrl(user, password) {
  return `postgres://${user}:${password}@127.0.0.1:${port}/${databaseName}?sslmode=disable`
}

function readMetadata() {
  return readFile(metadataPath, 'utf8').then((contents) => {
    const data = JSON.parse(contents)
    if (typeof data.migrationUrl !== 'string' || typeof data.runtimeUrl !== 'string') {
      throw new Error('Local database metadata is invalid.')
    }
    let migrationUrl
    let runtimeUrl
    try {
      migrationUrl = new URL(data.migrationUrl)
      runtimeUrl = new URL(data.runtimeUrl)
    } catch {
      throw new Error('Local database metadata is invalid.')
    }
    if (
      data.formatVersion !== 1
      || data.postgresMajor !== expectedMajor
      || data.port !== port
      || data.database !== databaseName
      || path.resolve(data.clusterPath) !== clusterPath
      || ![migrationUrl, runtimeUrl].every((url) =>
        ['postgres:', 'postgresql:'].includes(url.protocol)
        && url.hostname === '127.0.0.1'
        && url.port === String(port)
        && url.pathname === `/${databaseName}`
      )
      || decodeURIComponent(migrationUrl.username) !== 'lab002_migrator'
      || decodeURIComponent(runtimeUrl.username) !== 'lab002_app'
    ) {
      throw new Error('Local database metadata does not match this managed PostgreSQL 16 cluster.')
    }
    return data
  })
}

async function pathExists(target) {
  try {
    await stat(target)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function ensureManagedFiles() {
  await lockDataDirectory()
  const metadata = await readMetadata()
  await writeFile(envPath, `$env:NUXT_DATABASE_URL = '${metadata.runtimeUrl}'\r\n`, { mode: 0o600 })
  return metadata
}

function sameWindowsPath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function assertManagedServer(sql) {
  return sql`
    select current_setting('server_version_num')::int as version_num,
           current_user as role_name,
           current_database() as database_name,
           inet_server_addr() = inet '127.0.0.1' as is_loopback,
           inet_server_port() as server_port
  `.then((rows) => {
    const version = Number(rows[0].version_num)
    if (
      Math.floor(version / 10000) !== expectedMajor
      || rows[0].role_name !== 'lab002_migrator'
      || rows[0].database_name !== databaseName
      || !rows[0].is_loopback
      || Number(rows[0].server_port) !== port
    ) {
      throw new Error(`Managed PostgreSQL verification failed (major=${Math.floor(version / 10000)}, role=${rows[0].role_name}, database=${rows[0].database_name}, loopback=${rows[0].is_loopback}, port=${rows[0].server_port}).`)
    }
  })
}

async function isRunning() {
  try {
    run('pg_ctl', ['-D', clusterPath, 'status'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function start() {
  await lockDataDirectory()
  const metadataExists = await readFile(metadataPath).then(() => true, () => false)
  if (metadataExists) {
    const metadata = await ensureManagedFiles()
    if (!(await isRunning())) {
      run('pg_ctl', ['-D', clusterPath, '-l', path.join(dataRoot, 'postgres.log'), '-w', 'start'])
    }
    const sql = postgres(metadata.migrationUrl, { max: 1, connect_timeout: 5, idle_timeout: 2 })
    try {
      await assertManagedServer(sql)
    } finally {
      await sql.end({ timeout: 3 })
    }
    console.log(`Managed PostgreSQL ${expectedMajor} is running on 127.0.0.1:${port}.`)
    return
  }

  if (await pathExists(clusterPath)) {
    throw new Error('The managed cluster path already exists without metadata; inspect it manually. No files were changed.')
  }

  const initdb = executable('initdb')
  const bootstrapPassword = randomPassword()
  const migrationPassword = randomPassword()
  const runtimePassword = randomPassword()
  const bootstrapPasswordPath = path.join(dataRoot, 'bootstrap-password.txt')
  await writeFile(bootstrapPasswordPath, `${bootstrapPassword}\n`, { mode: 0o600, flag: 'wx' })
  await mkdir(clusterPath)
  try {
    execFileSync(initdb, [
      '-D', clusterPath,
      '-U', 'postgres',
      '--encoding=UTF8',
      '--locale=C',
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      `--pwfile=${bootstrapPasswordPath}`,
    ], { stdio: 'inherit' })

    await writeFile(path.join(clusterPath, 'postgresql.conf'), [
      "listen_addresses = '127.0.0.1'",
      `port = ${port}`,
      "password_encryption = 'scram-sha-256'",
      "timezone = 'UTC'",
      "log_statement = 'none'",
      "log_connections = off",
      '',
    ].join('\n'), { flag: 'a' })
    await writeFile(path.join(clusterPath, 'pg_hba.conf'), [
      'local all all scram-sha-256',
      'host all all 127.0.0.1/32 scram-sha-256',
      'host all all ::1/128 reject',
      '',
    ].join('\n'))

    run('pg_ctl', ['-D', clusterPath, '-l', path.join(dataRoot, 'postgres.log'), '-w', 'start'])
    const admin = postgres(`postgres://postgres:${bootstrapPassword}@127.0.0.1:${port}/postgres?sslmode=disable`, { max: 1, connect_timeout: 5 })
    try {
      const [server] = await admin`
        select current_setting('server_version_num')::int as version_num,
               current_user as role_name,
               current_database() as database_name,
               inet_server_addr() = inet '127.0.0.1' as is_loopback,
               inet_server_port() as server_port
      `
      if (
        Math.floor(Number(server.version_num) / 10000) !== expectedMajor
        || server.role_name !== 'postgres'
        || server.database_name !== 'postgres'
        || !server.is_loopback
        || Number(server.server_port) !== port
      ) {
        throw new Error(`Managed database server must be PostgreSQL ${expectedMajor}.`)
      }
      await admin.unsafe(`CREATE ROLE lab002_migrator LOGIN PASSWORD '${migrationPassword}'`)
      await admin.unsafe(`CREATE ROLE lab002_app LOGIN PASSWORD '${runtimePassword}'`)
      await admin.unsafe(`CREATE DATABASE ${databaseName} OWNER lab002_migrator`)
      await admin.unsafe('ALTER ROLE postgres NOLOGIN PASSWORD NULL')
    } finally {
      await admin.end({ timeout: 3 })
    }

    const metadata = {
      formatVersion: 1,
      postgresMajor: expectedMajor,
      port,
      database: databaseName,
      clusterPath,
      migrationUrl: databaseUrl('lab002_migrator', migrationPassword),
      runtimeUrl: databaseUrl('lab002_app', runtimePassword),
    }
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await writeFile(envPath, `$env:NUXT_DATABASE_URL = '${metadata.runtimeUrl}'\r\n`, { flag: 'wx', mode: 0o600 })
  } finally {
    await rm(bootstrapPasswordPath, { force: true })
  }
  console.log(`Managed PostgreSQL ${expectedMajor} is running on 127.0.0.1:${port}.`)
}

async function stop() {
  await ensureManagedFiles()
  if (!(await isRunning())) {
    console.log('Managed PostgreSQL is already stopped.')
    return
  }
  run('pg_ctl', ['-D', clusterPath, '-m', 'fast', '-w', 'stop'])
  console.log('Managed PostgreSQL is stopped.')
}

async function status() {
  const metadata = await ensureManagedFiles()
  if (!(await isRunning())) {
    console.log(`Managed PostgreSQL is stopped. Cluster: ${clusterPath}`)
    return
  }
  const sql = postgres(metadata.migrationUrl, { max: 1, connect_timeout: 5 })
  try {
    await assertManagedServer(sql)
    console.log(`Managed PostgreSQL ${expectedMajor} is running on 127.0.0.1:${port}.`)
  } finally {
    await sql.end({ timeout: 3 })
  }
}

const command = process.argv[2]
try {
  if (command === 'start') await start()
  else if (command === 'stop') await stop()
  else if (command === 'status') await status()
  else throw new Error('Usage: node scripts/local-db.mjs <start|stop|status>')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local database operation failed.')
  process.exitCode = 1
}
