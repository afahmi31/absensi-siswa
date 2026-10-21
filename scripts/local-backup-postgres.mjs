import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import postgres from 'postgres'
import { TEST_ROOT, ownedDirectory, verifyOwned, writePrivate, directory, cleanup, fail } from './local-backup-files.mjs'

export const PG_BIN = 'C:\\Program Files\\PostgreSQL\\16\\bin'
export const secret = () => randomBytes(32).toString('hex')
export function childEnvironment(extra = {}) {
  const env = { ...process.env }
  for (const name of Object.keys(env)) {
    if (/^(PG|SUPABASE_|NUXT_|DATABASE_URL$|LAB002_.*(?:URL|PASSWORD|SECRET))/i.test(name)) delete env[name]
  }
  return { ...env, ...extra }
}
export function runChild(executable, args, { env = childEnvironment(), timeout = 120000, max = 1024 * 1024, input, signal, capture = true, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, env, cwd, stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'ignore' })
    const chunks = []; let size = 0; let rejected = false
    const stop = () => { rejected = true; child.kill(); child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy() }
    const timer = setTimeout(stop, timeout)
    signal?.addEventListener('abort', stop, { once: true })
    child.stdout?.on('data', (chunk) => { size += chunk.length; if (size > max) stop(); else chunks.push(chunk) })
    // Consume, never expose SQL/password/PII from PostgreSQL errors.
    child.stderr?.resume()
    child.stdin?.on('error', () => {})
    child.on('error', () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(new Error('Local backup child could not start.')) })
    child.on('close', (code) => {
      clearTimeout(timer); signal?.removeEventListener('abort', stop)
      if (rejected || code !== 0) reject(new Error(rejected ? 'Local backup child timeout/cancel/output limit.' : 'Local backup child failed.'))
      else resolve(Buffer.concat(chunks))
    })
    if (signal?.aborted) stop()
    child.stdin?.end(input)
  })
}
export function pgTool(name, args, options) {
  if (!['initdb', 'pg_ctl', 'pg_dump', 'pg_restore', 'psql'].includes(name)) fail('PG-tool')
  return runChild(path.join(PG_BIN, `${name}.exe`), args, { ...options, ...((name === 'pg_ctl' && args.some((arg) => ['start','stop'].includes(arg))) ? { capture: false } : {}) })
}
export const connect = (url, { onclose } = {}) => postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 2, prepare: false, onnotice: () => {}, onclose })
export function connectionArgs(url) {
  const value = new URL(url)
  if (value.protocol !== 'postgres:' || value.hostname !== '127.0.0.1' || !value.password || [...value.searchParams.keys()].some((key) => key !== 'sslmode') || value.searchParams.get('sslmode') !== 'disable') fail('connection')
  return {
    args: ['--host', '127.0.0.1', '--port', value.port, '--username', decodeURIComponent(value.username), '--dbname', value.pathname.slice(1), '--no-password'],
    env: childEnvironment({ PGPASSWORD: decodeURIComponent(value.password), PGSSLMODE: 'disable' }),
  }
}
async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if ([5432, 55432].includes(port)) return freePort()
  return port
}
const clusters = new WeakMap()
export async function verifyCluster(capability) {
  const state = clusters.get(capability)
  if (!state || state.closed) fail('cluster-capability')
  await verifyOwned(state.receipt)
  await directory(state.dataDirectory)
  const info = await lstat(state.dataDirectory)
  if (info.dev !== state.identity.dev || info.ino !== state.identity.ino) fail('cluster-identity')
  const pid = (await readFile(path.join(state.dataDirectory, 'postmaster.pid'), 'utf8')).split(/\r?\n/)
  if (Number(pid[0]) !== state.pid || path.resolve(pid[1]) !== state.dataDirectory || Number(pid[3]) !== state.port) fail('cluster-PID')
  const database = connect(state.migrationUrl)
  try {
    const [row] = await database`select current_database() as db, current_user as role, host(inet_server_addr()) as host, inet_server_port() as port, current_setting('server_version_num')::int as version, current_setting('data_directory') as directory, pg_postmaster_start_time()::text as started, (select rolname from pg_roles where oid=(select datdba from pg_database where datname=current_database())) as owner, pg_has_role('lab002_migrator','pg_read_all_settings','member') as migrator_settings, pg_has_role('lab002_app','pg_read_all_settings','member') as runtime_settings`
    if (path.resolve(row.directory)!==state.dataDirectory || !row.migrator_settings || row.runtime_settings || row.db !== 'lab002_test' || row.role !== 'lab002_migrator' || row.owner !== 'lab002_migrator' || row.host !== '127.0.0.1' || row.port !== state.port || Math.floor(row.version / 10000) !== 16 || (state.started && state.started !== row.started)) fail('cluster-server')
    if (!state.started) state.started = row.started
  } finally { await database.end({ timeout: 3 }) }
  return state
}
export async function newCluster({ beforeStart } = {}) {
  const receipt = await ownedDirectory(TEST_ROOT, 'cluster')
  const dataDirectory = path.join(receipt.path, 'pg')
  const port = await freePort()
  const bootstrap = secret(), migration = secret(), runtime = secret()
  const url = (user, password) => `postgres://${user}:${password}@127.0.0.1:${port}/lab002_test?sslmode=disable`
  const capability = Object.freeze({})
  let running = false
  try {
    const version = (await pgTool('pg_ctl', ['--version'])).toString()
    if (!/\b16\./.test(version)) fail('PG16')
    await writePrivate(path.join(receipt.path, 'bootstrap'), `${bootstrap}\n`)
    await pgTool('initdb', ['-D', dataDirectory, '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', `--pwfile=${path.join(receipt.path, 'bootstrap')}`])
    await writePrivate(path.join(dataDirectory, 'backup-config.conf'), `listen_addresses='127.0.0.1'\nport=${port}\npassword_encryption='scram-sha-256'\ntimezone='UTC'\nlog_statement='none'\nlog_connections=off\n`)
    await beforeStart?.({port})
    await pgTool('pg_ctl', ['-D', dataDirectory, '-l', path.join(receipt.path, 'postgres.log'), '-o', `-c config_file=${path.join(dataDirectory, 'backup-config.conf').replaceAll('\\', '/')}`, '-w', '-t', '15', 'start'])
    running = true
    const admin = connect(`postgres://postgres:${bootstrap}@127.0.0.1:${port}/postgres?sslmode=disable`)
    try {
      await admin.unsafe(`CREATE ROLE lab002_migrator LOGIN PASSWORD '${migration}'`)
      // PM-approved only for this newly generated disposable target, never managed source.
      await admin.unsafe('GRANT pg_read_all_settings TO lab002_migrator')
      await admin.unsafe(`CREATE ROLE lab002_app LOGIN PASSWORD '${runtime}'`)
      await admin.unsafe('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
      await admin.unsafe('CREATE DATABASE lab002_test OWNER lab002_migrator')
      await admin.unsafe('ALTER ROLE postgres NOLOGIN PASSWORD NULL')
    } finally { await admin.end({ timeout: 3 }) }
    const pid = Number((await readFile(path.join(dataDirectory, 'postmaster.pid'), 'utf8')).split(/\r?\n/)[0])
    const state = { receipt, dataDirectory, identity: await lstat(dataDirectory), port, pid, migrationUrl: url('lab002_migrator', migration), runtimeUrl: url('lab002_app', runtime), closed: false }
    clusters.set(capability, state)
    await verifyCluster(capability)
    return capability
  } catch (error) {
    const pidFile = await readFile(path.join(dataDirectory,'postmaster.pid'),'utf8').catch((e) => e.code === 'ENOENT' ? null : Promise.reject(e))
    if (running || pidFile) {
      // Startup failure still belongs to this exclusive directory; do not delete if stop fails.
      await verifyOwned(receipt)
      await directory(dataDirectory)
      if (pidFile) {
        const lines=pidFile.split(/\r?\n/)
        if (path.resolve(lines[1])!==dataDirectory || Number(lines[3])!==port || !Number.isSafeInteger(Number(lines[0]))) fail('startup-PID-mismatch')
      }
      await pgTool('pg_ctl', ['-D', dataDirectory, '-m', 'fast', '-w', '-t', '15', 'stop'])
    }
    await cleanup(receipt)
    throw error
  }
}
export async function clusterConnection(capability, role = 'migration') {
  const state = await verifyCluster(capability)
  return role === 'runtime' ? state.runtimeUrl : state.migrationUrl
}
export async function destroyCluster(capability) {
  const state = await verifyCluster(capability)
  await pgTool('pg_ctl', ['-D', state.dataDirectory, '-m', 'fast', '-w', '-t', '15', 'stop'])
  state.closed = true
  await cleanup(state.receipt)
  clusters.delete(capability)
}
