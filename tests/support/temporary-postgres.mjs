import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dataRoot = path.join(appRoot, '.cache')
const testRoot = path.join(dataRoot, 'tests')
const pgBin = 'C:\\Program Files\\PostgreSQL\\16\\bin'

function pgExecutable(name) {
  const target = path.join(pgBin, `${name}.exe`)
  const version = execFileSync(target, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (!/\b16\./.test(version)) throw new Error('Database tests require the installed PostgreSQL 16 binaries.')
  return target
}

function protectDataRoot() {
  const output = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' })
  const sid = output.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) throw new Error('Could not secure the local test directory.')
  execFileSync('icacls.exe', [
    testRoot,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:(OI)(CI)F`,
    '*S-1-5-18:(OI)(CI)F',
  ], { stdio: 'ignore' })
}

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

function runPg(name, args, options = {}) {
  execFileSync(pgExecutable(name), args, { stdio: 'ignore', ...options })
}

async function removeOwnedCluster(clusterPath, owned) {
  if (!owned) return
  const resolved = path.resolve(clusterPath)
  const parent = path.resolve(testRoot)
  const suffix = path.basename(resolved)
  if (path.dirname(resolved) !== parent || !/^cluster-[0-9a-f-]{36}$/.test(suffix)) {
    throw new Error('Refusing to remove a directory outside the generated temporary PostgreSQL test cluster.')
  }
  const info = await stat(resolved).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!info?.isDirectory()) throw new Error('Refusing to remove a path that is not the owned test cluster directory.')
  await rm(resolved, { recursive: true, force: false })
}

export async function startTemporaryPostgres() {
  await mkdir(testRoot, { recursive: true })
  protectDataRoot()
  const clusterPath = path.join(testRoot, `cluster-${randomUUID()}`)
  const port = await availablePort()
  const bootstrapPassword = randomBytes(32).toString('hex')
  const migrationPassword = randomBytes(32).toString('hex')
  const runtimePassword = randomBytes(32).toString('hex')
  const apiPasswords = {
    anon: randomBytes(32).toString('hex'),
    authenticated: randomBytes(32).toString('hex'),
    service_role: randomBytes(32).toString('hex'),
  }
  const passwordPath = path.join(testRoot, `bootstrap-${randomUUID()}.txt`)
  let started = false

  try {
    await writeFile(passwordPath, `${bootstrapPassword}\n`, { flag: 'wx', mode: 0o600 })
    await mkdir(clusterPath)
    execFileSync(pgExecutable('initdb'), [
      '-D', clusterPath,
      '-U', 'postgres',
      '--encoding=UTF8',
      '--locale=C',
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      `--pwfile=${passwordPath}`,
    ], { stdio: 'ignore' })
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
    runPg('pg_ctl', ['-D', clusterPath, '-l', path.join(clusterPath, 'server.log'), '-w', 'start'])
    started = true

    const admin = (await import('postgres')).default(
      `postgres://postgres:${bootstrapPassword}@127.0.0.1:${port}/postgres?sslmode=disable`,
      { max: 1, connect_timeout: 5 },
    )
    try {
      const [server] = await admin`select current_setting('server_version_num')::int as version_num`
      if (Math.floor(Number(server.version_num) / 10000) !== 16) {
        throw new Error('Database tests require PostgreSQL 16.')
      }
      await admin.unsafe(`CREATE ROLE lab002_migrator LOGIN PASSWORD '${migrationPassword}'`)
      await admin.unsafe(`CREATE ROLE lab002_app LOGIN PASSWORD '${runtimePassword}'`)
      await admin.unsafe(`CREATE ROLE anon LOGIN PASSWORD '${apiPasswords.anon}'`)
      await admin.unsafe(`CREATE ROLE authenticated LOGIN PASSWORD '${apiPasswords.authenticated}'`)
      await admin.unsafe(`CREATE ROLE service_role LOGIN BYPASSRLS PASSWORD '${apiPasswords.service_role}'`)
      await admin.unsafe('CREATE DATABASE lab002_test OWNER lab002_migrator')
      await admin.unsafe('ALTER ROLE postgres NOLOGIN PASSWORD NULL')
    } finally {
      await admin.end({ timeout: 3 })
    }

    const connectionUrl = (user, password) => `postgres://${user}:${password}@127.0.0.1:${port}/lab002_test?sslmode=disable`
    const apiUrls = Object.fromEntries(Object.entries(apiPasswords).map(([role, password]) => [role, connectionUrl(role, password)]))
    return {
      clusterPath,
      port,
      migrationUrl: connectionUrl('lab002_migrator', migrationPassword),
      runtimeUrl: connectionUrl('lab002_app', runtimePassword),
      apiUrls,
      async cleanup() {
        if (started) runPg('pg_ctl', ['-D', clusterPath, '-m', 'fast', '-w', 'stop'])
        await removeOwnedCluster(clusterPath, true)
        await rm(passwordPath, { force: true })
      },
    }
  } catch (error) {
    if (started) {
      try { runPg('pg_ctl', ['-D', clusterPath, '-m', 'immediate', '-w', 'stop']) } catch {}
    }
    await rm(passwordPath, { force: true })
    if (await stat(clusterPath).then(() => true, () => false)) await removeOwnedCluster(clusterPath, true)
    throw error
  }
}
