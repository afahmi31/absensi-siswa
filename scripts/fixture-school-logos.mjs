import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import sharp from 'sharp'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pgBin = 'C:\\Program Files\\PostgreSQL\\16\\bin'
const passwordHasher = new Scrypt({})

function pgExecutable(name) {
  const executable = path.join(pgBin, `${name}.exe`)
  const version = execFileSync(executable, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (!/\b16\./.test(version)) throw new Error('Fixture memerlukan PostgreSQL 16 yang sudah tersedia di komputer ini.')
  return executable
}

function runPg(name, args, options = {}) {
  return execFileSync(pgExecutable(name), args, { stdio: 'ignore', ...options })
}

function secureDirectory(directory) {
  const output = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' })
  const sid = output.match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) throw new Error('Tidak dapat membatasi akses folder fixture lokal.')
  execFileSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'ignore' })
}

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Tidak dapat memilih port loopback.')
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

function databaseUrl(user, password, port) {
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/lab002_fixture?sslmode=disable`
}

async function startPostgres(privateRoot) {
  const clusterPath = path.join(privateRoot, 'postgres')
  const port = await availablePort()
  const bootstrapPassword = randomBytes(32).toString('hex')
  const migrationPassword = randomBytes(32).toString('hex')
  const runtimePassword = randomBytes(32).toString('hex')
  const apiPasswords = Object.fromEntries(['anon', 'authenticated', 'service_role'].map((role) => [role, randomBytes(32).toString('hex')]))
  const bootstrapPath = path.join(privateRoot, 'bootstrap-password.txt')
  await writeFile(bootstrapPath, `${bootstrapPassword}\n`, { flag: 'wx', mode: 0o600 })
  await mkdir(clusterPath)
  execFileSync(pgExecutable('initdb'), [
    '-D', clusterPath, '-U', 'postgres', '--encoding=UTF8', '--locale=C',
    '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', `--pwfile=${bootstrapPath}`,
  ], { stdio: 'ignore' })
  await writeFile(path.join(clusterPath, 'postgresql.conf'), [
    "listen_addresses = '127.0.0.1'", `port = ${port}`, "password_encryption = 'scram-sha-256'",
    "timezone = 'UTC'", "log_statement = 'none'", 'log_connections = off', '',
  ].join('\n'), { flag: 'a' })
  await writeFile(path.join(clusterPath, 'pg_hba.conf'), [
    'local all all scram-sha-256', 'host all all 127.0.0.1/32 scram-sha-256', 'host all all ::1/128 reject', '',
  ].join('\n'))
  runPg('pg_ctl', ['-D', clusterPath, '-l', path.join(privateRoot, 'postgres.log'), '-w', 'start'])

  const admin = postgres(`postgres://postgres:${bootstrapPassword}@127.0.0.1:${port}/postgres?sslmode=disable`, { max: 1, connect_timeout: 5 })
  try {
    const [version] = await admin`select current_setting('server_version_num')::int as version_num`
    if (Math.floor(Number(version.version_num) / 10000) !== 16) throw new Error('Fixture hanya menerima PostgreSQL 16.')
    await admin.unsafe(`CREATE ROLE lab002_migrator LOGIN PASSWORD '${migrationPassword}'`)
    await admin.unsafe(`CREATE ROLE lab002_app LOGIN PASSWORD '${runtimePassword}'`)
    await admin.unsafe(`CREATE ROLE anon LOGIN PASSWORD '${apiPasswords.anon}'`)
    await admin.unsafe(`CREATE ROLE authenticated LOGIN PASSWORD '${apiPasswords.authenticated}'`)
    await admin.unsafe(`CREATE ROLE service_role LOGIN BYPASSRLS PASSWORD '${apiPasswords.service_role}'`)
    await admin.unsafe('CREATE DATABASE lab002_fixture OWNER lab002_migrator')
    await admin.unsafe('ALTER ROLE postgres NOLOGIN PASSWORD NULL')
  } finally {
    await admin.end({ timeout: 3 })
    await rm(bootstrapPath, { force: true })
  }

  return {
    clusterPath,
    migrationUrl: databaseUrl('lab002_migrator', migrationPassword, port),
    runtimeUrl: databaseUrl('lab002_app', runtimePassword, port),
    async stop() { runPg('pg_ctl', ['-D', clusterPath, '-m', 'fast', '-w', 'stop']) },
  }
}

async function createFixture(privateRoot, temporary) {
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const email = `logo-${randomUUID().slice(0, 8)}@example.invalid`
  const password = randomBytes(24).toString('base64url')
  const storageRoot = path.join(privateRoot, 'logo-store')
  await mkdir(storageRoot)
  const png = await sharp({ create: { width: 160, height: 96, channels: 4, background: { r: 28, g: 115, b: 88, alpha: 1 } } })
    .png().toBuffer()
  const jpeg = await sharp({ create: { width: 128, height: 128, channels: 3, background: { r: 198, g: 142, b: 45 } } })
    .jpeg().toBuffer()
  try {
    await runMigrations(migrator, 'up')
    await provisionTeacherAccount(migrator, email, await passwordHasher.make(password))
  } finally {
    await migrator.end({ timeout: 3 })
  }

  const fixturePaths = {
    png: path.join(privateRoot, 'valid-school-logo.png'),
    jpeg: path.join(privateRoot, 'valid-school-logo.jpg'),
    invalid: path.join(privateRoot, 'invalid-signature.png'),
    oversized: path.join(privateRoot, 'oversized-logo.png'),
  }
  await Promise.all([
    writeFile(fixturePaths.png, png, { flag: 'wx', mode: 0o600 }),
    writeFile(fixturePaths.jpeg, jpeg, { flag: 'wx', mode: 0o600 }),
    writeFile(fixturePaths.invalid, Buffer.from('not a PNG or JPEG'), { flag: 'wx', mode: 0o600 }),
    writeFile(fixturePaths.oversized, Buffer.alloc(2 * 1024 * 1024 + 1), { flag: 'wx', mode: 0o600 }),
  ])
  return { email, password, fixturePaths }
}

async function createIsolatedNuxtRoot(privateRoot) {
  const root = await mkdtemp(path.join(privateRoot, 'nuxt-'))
  try {
    for (const entry of ['app', 'server', 'shared']) await cp(path.join(appRoot, entry), path.join(root, entry), { recursive: true })
    for (const entry of ['nuxt.config.ts', 'package.json']) await cp(path.join(appRoot, entry), path.join(root, entry))
    await symlink(path.join(appRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
    return root
  } catch (error) {
    await removeIsolatedNuxtRoot(root, privateRoot)
    throw error
  }
}

async function removeIsolatedNuxtRoot(root, privateRoot) {
  const resolved = await realpath(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!resolved) return
  const ownedRoot = await realpath(privateRoot)
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^nuxt-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new Error('Menolak menghapus folder Nuxt di luar fixture yang dibuat script ini.')
  }
  const modulesPath = path.join(resolved, 'node_modules')
  const info = await lstat(modulesPath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (info) {
    if (!info.isSymbolicLink()) throw new Error('Junction node_modules fixture berubah.')
    await unlink(modulesPath)
  }
  await rm(resolved, { recursive: true, force: false })
}

function sanitize(output, secrets) {
  let result = output
  for (const secret of secrets) result = result.replaceAll(secret, '[redacted]')
  return result.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database-url-redacted]').slice(-3_000).trim()
}

async function waitForServer(child, baseUrl, getOutput, secrets) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostics = sanitize(getOutput(), secrets)
      throw new Error(`Server fixture berhenti (exit ${child.exitCode ?? child.signalCode}).${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
    } catch {}
    await delay(350)
  }
  throw new Error(`Server fixture belum siap.${sanitize(getOutput(), secrets) ? `\n${sanitize(getOutput(), secrets)}` : ''}`)
}

async function stopOwnedProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(8_000)])
  if (child.exitCode === null && !child.signalCode && child.pid) execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
}

async function runFixture() {
  const compiledSmoke = process.argv.includes('--compiled-smoke')
  if (!process.stdin.isTTY && !compiledSmoke) throw new Error('Fixture harus dijalankan pada terminal interaktif agar STOP dapat dipakai.')
  const fixtureParent = path.join(appRoot, '.cache')
  await mkdir(fixtureParent, { recursive: true })
  const privateRoot = await mkdtemp(path.join(fixtureParent, 'school-logo-fixture-'))
  secureDirectory(privateRoot)
  let temporary
  let server
  let isolatedNuxtRoot
  let output = ''
  let shutdownRequested = false
  let sourceManifest
  const requestShutdown = () => { shutdownRequested = true }
  const onFixtureInput = (chunk) => { if (String(chunk).trim().toLowerCase() === 'stop') requestShutdown() }
  process.once('SIGINT', requestShutdown)
  process.once('SIGTERM', requestShutdown)
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', onFixtureInput)
  process.stdin.resume()

  try {
    temporary = await startPostgres(privateRoot)
    const credentials = await createFixture(privateRoot, temporary)
    const sessionPassword = randomBytes(48).toString('base64url')
    const httpPort = await availablePort()
    const baseUrl = `http://127.0.0.1:${httpPort}`
    const logoRoot = path.join(privateRoot, 'logo-store')
    isolatedNuxtRoot = await createIsolatedNuxtRoot(privateRoot)
    if (compiledSmoke) {
      sourceManifest = {}
      for (const entry of ['app', 'server', 'shared', 'nuxt.config.ts', 'package.json']) {
        const info = await lstat(path.join(appRoot, entry))
        const files = info.isDirectory() ? (await readdir(path.join(appRoot, entry), { recursive: true, withFileTypes: true })).filter((item) => item.isFile()).map((item) => path.relative(appRoot, path.join(item.parentPath, item.name))) : [entry]
        for (const file of files) {
          const source = createHash('sha256').update(await readFile(path.join(appRoot, file))).digest('hex')
          const copy = createHash('sha256').update(await readFile(path.join(isolatedNuxtRoot, file))).digest('hex')
          assert.equal(copy, source, `isolated source copy ${file}`)
          sourceManifest[file.replaceAll('\\', '/')] = source
        }
      }
      for (const preset of ['vercel', 'node-server']) {
        await new Promise((resolve, reject) => {
          const build = spawn(process.execPath, [path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'), 'build', '--preset', preset, isolatedNuxtRoot], {
            cwd: isolatedNuxtRoot, env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit', windowsHide: true,
          })
          build.once('error', reject)
          build.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build ${preset} failed (${code}).`)))
        })
        console.log(`PASS isolated build ${preset}`)
        if (preset === 'vercel') {
          const config = JSON.parse(await readFile(path.join(isolatedNuxtRoot, '.vercel/output/functions/__fallback.func/.vc-config.json'), 'utf8'))
          assert.equal(config.runtime, 'nodejs24.x')
          console.log('PASS Vercel artifact runtime nodejs24.x (local Windows build, not Linux execution).')
        }
      }
    }
    const childEnvironment = { ...process.env }
    delete childEnvironment.VERCEL
    delete childEnvironment.VERCEL_ENV
    Object.assign(childEnvironment, {
      NODE_ENV: compiledSmoke ? 'production' : 'development',
      NUXT_DATABASE_URL: temporary.runtimeUrl,
      NUXT_DATABASE_MODE: 'local',
      NUXT_SESSION_PASSWORD: sessionPassword,
      NUXT_TELEMETRY_DISABLED: '1',
      LAB002_FIXTURE: '1',
      LAB002_SCHOOL_LOGO_LOCAL_STORAGE: '1',
      LAB002_SCHOOL_LOGO_ROOT: logoRoot,
      PORT: String(httpPort),
      HOST: '127.0.0.1',
    })
    const serverArgs = compiledSmoke ? [path.join(isolatedNuxtRoot, '.output/server/index.mjs')] : [
      path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'), 'dev', '--host', '127.0.0.1', '--port', String(httpPort),
      '--no-fork', '--no-tui', '--strictPort', isolatedNuxtRoot,
    ]
    server = spawn(process.execPath, serverArgs, { cwd: isolatedNuxtRoot, env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    server.stdout?.on('data', (chunk) => { output = `${output}${chunk.toString('utf8')}`.slice(-12_000) })
    server.stderr?.on('data', (chunk) => { output = `${output}${chunk.toString('utf8')}`.slice(-12_000) })
    await waitForServer(server, baseUrl, () => output, [credentials.password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    if (compiledSmoke) {
      const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ email: credentials.email, password: credentials.password }), signal: AbortSignal.timeout(5000) })
      assert.equal(login.status, 200)
      const cookie = login.headers.get('set-cookie')?.split(';', 1)[0]
      assert.ok(cookie)
      const bytes = await readFile(credentials.fixturePaths.png)
      const form = new FormData()
      form.append('metadata', JSON.stringify({ name: 'Compiled synthetic school', className: 'Fixture', timeZone: 'Asia/Jakarta', logoAction: 'replace' }))
      form.append('logo', new Blob([bytes], { type: 'image/png' }), 'synthetic.png')
      const saved = await fetch(`${baseUrl}/api/school`, { method: 'PUT', headers: { origin: baseUrl, cookie }, body: form, signal: AbortSignal.timeout(5000) })
      assert.equal(saved.status, 200, 'compiled HTTP upload')
      const assetId = (await saved.json()).school.logoAssetId
      const read = await fetch(`${baseUrl}/api/school/logo/${assetId}`, { headers: { cookie }, signal: AbortSignal.timeout(5000) })
      assert.equal(read.status, 200, 'compiled HTTP private logo read')
      assert.equal(read.headers.get('content-type'), 'image/png')
      assert.equal(read.headers.get('x-content-type-options'), 'nosniff')
      assert.match(read.headers.get('cache-control'), /no-store/)
      assert.deepEqual(Buffer.from(await read.arrayBuffer()), bytes)
      for (const [file, hash] of Object.entries(sourceManifest)) assert.equal(createHash('sha256').update(await readFile(path.join(appRoot, file))).digest('hex'), hash, `source stable after compiled smoke ${file}`)
      await writeFile(path.join(fixtureParent, 'LAB002-OPS-001A-compiled-evidence.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version, platform: process.platform, presets: ['vercel', 'node-server'], vercelRuntime: 'nodejs24.x', login: 200, upload: 200, read: 200, byteIdentical: true, sourceManifest }, null, 2))
      console.log('PASS compiled Windows Node24 HTTP login200 upload200 read200 byte-identical; local synthetic storage only.')
      return
    }

    console.log('Fixture logo sintetis siap, hanya pada loopback.')
    console.log(`URL: ${baseUrl}`)
    console.log(`Akun uji: ${credentials.email}`)
    console.log(`Kata sandi uji: ${credentials.password}`)
    console.log(`PNG valid: ${credentials.fixturePaths.png}`)
    console.log(`JPEG valid: ${credentials.fixturePaths.jpeg}`)
    console.log(`Signature rusak: ${credentials.fixturePaths.invalid}`)
    console.log(`Lebih dari 2 MB: ${credentials.fixturePaths.oversized}`)
    console.log('Akun ini belum memiliki sekolah agar alur setup pertama juga bisa diuji. Server dan PostgreSQL hanya bind ke 127.0.0.1.')
    console.log('Untuk berhenti dan membersihkan proses/folder milik fixture: ketik STOP lalu Enter pada sesi ini.')

    await new Promise((resolve) => {
      const checkShutdown = setInterval(() => {
        if (shutdownRequested || server.exitCode !== null || server.signalCode !== null) {
          clearInterval(checkShutdown)
          resolve()
        }
      }, 100)
      checkShutdown.unref()
    })
  } finally {
    process.stdin.off('data', onFixtureInput)
    process.stdin.pause()
    process.off('SIGINT', requestShutdown)
    process.off('SIGTERM', requestShutdown)
    await stopOwnedProcess(server)
    if (temporary) await Promise.resolve(temporary.stop()).catch(() => undefined)
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot, privateRoot)
    const info = await lstat(privateRoot).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    const resolved = await realpath(privateRoot).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    const ownedParent = await realpath(fixtureParent).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
    if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error('Menolak cleanup root fixture yang bukan direktori milik script.')
    if (resolved && ownedParent && info && path.dirname(resolved).toLowerCase() === ownedParent.toLowerCase()
      && resolved.toLowerCase() === path.resolve(privateRoot).toLowerCase()
      && /^school-logo-fixture-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
      await rm(resolved, { recursive: true, force: false })
    }
  }
}

runFixture().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message)
    if (error.stack) console.error(error.stack.split(/\r?\n/).slice(1).join('\n'))
  } else console.error('Fixture logo sintetis gagal disiapkan.')
  process.exitCode = 1
})
