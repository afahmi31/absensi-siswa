import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { listMigrationNames } from './support/migration-names.mjs'
import { provisionTeacherAccount, resetTeacherAccountPassword } from '../server/auth/account-admin.ts'
import { isLoginBlocked, recordLoginFailure } from '../server/auth/login-throttle.ts'
import { shouldUseSecureSessionCookie } from '../server/auth/session-cookie.ts'
import { createTeacherSession, findTeacherSession } from '../server/database/repositories/teacher-accounts.ts'
import { databaseConnectionOptions, databaseConnectionUrl } from '../server/database/client.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.data', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

function fetchLocal(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  // This local test adapter exercises the trusted Vercel-header branch through the actual HTTP login route.
  headers.set('x-vercel-forwarded-for', '198.51.100.42')
  return fetch(input, { ...init, headers, signal: AbortSignal.timeout(requestTimeoutMs) })
}

async function createIsolatedNuxtRoot(): Promise<string> {
  await mkdir(testRoot, { recursive: true })
  const root = await mkdtemp(path.join(testRoot, 'nuxt-root-'))
  try {
    for (const entry of ['app', 'server', 'shared']) {
      await cp(path.join(appRoot, entry), path.join(root, entry), { recursive: true })
    }
    for (const entry of ['nuxt.config.ts', 'package.json']) {
      await cp(path.join(appRoot, entry), path.join(root, entry))
    }
    await symlink(path.join(appRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
    return root
  } catch (error) {
    await removeIsolatedNuxtRoot(root)
    throw error
  }
}

/** Replace the copied connector only in disposable Nuxt roots used by local HTTP tests. */
async function useLoopbackPostgresInIsolatedRoot(root: string): Promise<void> {
  const clientPath = path.join(root, 'server/database/client.ts')
  const source = await readFile(clientPath, 'utf8')
  const start = source.indexOf('export function databaseConnectionOptions(')
  const end = source.indexOf('\n/** Create the lazy, server-only database connection', start)
  assert.ok(start >= 0 && end > start, 'test-only connector patch should match the copied production connector')
  const fixtureConnector = `export function databaseConnectionOptions(mode: string, databaseUrl: string, _caCertificate: string) {
  let target: URL
  try { target = new URL(databaseUrl) } catch { throw new Error('Fixture database configuration is invalid.') }
  if (mode !== 'supabase' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname.toLowerCase())) {
    throw new Error('The isolated HTTP test only accepts its local fixture PostgreSQL server.')
  }
  return {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
    connection: { application_name: 'lab002-website-absensi-siswa-test-fixture' },
  }
}
`
  await writeFile(clientPath, `${source.slice(0, start)}${fixtureConnector}${source.slice(end)}`, 'utf8')
}

async function removeIsolatedNuxtRoot(root: string): Promise<void> {
  const resolved = await realpath(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!resolved) return
  const ownedRoot = await realpath(testRoot)
  if (
    path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase()
    || !/^nuxt-root-[A-Za-z0-9]+$/.test(path.basename(resolved))
  ) {
    throw new Error('Refusing to remove an isolated Nuxt project outside the generated test directory.')
  }
  const modulesPath = path.join(resolved, 'node_modules')
  const modulesInfo = await lstat(modulesPath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (modulesInfo) {
    if (!modulesInfo.isSymbolicLink()) throw new Error('Refusing to remove an isolated Nuxt project with an unexpected node_modules path.')
    await unlink(modulesPath)
  }
  await rm(resolved, { recursive: true, force: false })
}

test('local login throttle counts five failures and releases the client after the block expires', () => {
  const ip = `throttle-unit-${randomUUID()}`
  const startedAt = 1_800_000_000_000
  for (let failure = 0; failure < 4; failure += 1) {
    recordLoginFailure(ip, startedAt + failure)
    assert.equal(isLoginBlocked(ip, startedAt + failure), false)
  }
  recordLoginFailure(ip, startedAt + 4)
  assert.equal(isLoginBlocked(ip, startedAt + 4), true)
  assert.equal(isLoginBlocked(ip, startedAt + 15 * 60 * 1000 + 3), true)
  assert.equal(isLoginBlocked(ip, startedAt + 15 * 60 * 1000 + 5), false)
})

test('Supabase connection options require the fixed role, project, Session pooler, and verified CA TLS', () => {
  const databaseUrl = 'postgres://lab002_app.jkiewjlohgmsujcwerpi:fixture-password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full'
  const ca = '-----BEGIN CERTIFICATE-----\nfixture-only\n-----END CERTIFICATE-----'
  const normalizedUrl = databaseConnectionUrl('supabase', databaseUrl)
  assert.equal(new URL(normalizedUrl).search, '')
  const options = databaseConnectionOptions('supabase', databaseUrl, ca)
  assert.equal(options.max, 1)
  assert.equal(options.prepare, false)
  assert.deepEqual(options.ssl, {
    ca,
    rejectUnauthorized: true,
    servername: 'aws-0-ap-southeast-1.pooler.supabase.com',
  })
  assert.throws(() => databaseConnectionUrl('supabase', databaseUrl.replace('verify-full', 'no-verify')))
  assert.throws(() => databaseConnectionUrl('supabase', `${databaseUrl}&ssl=false`))
  assert.throws(() => databaseConnectionOptions('supabase', databaseUrl.replace('lab002_app.', 'postgres.'), ca))
  assert.throws(() => databaseConnectionOptions('supabase', databaseUrl.replace('jkiewjlohgmsujcwerpi', 'wrongprojectref00000'), ca))
  assert.throws(() => databaseConnectionOptions('supabase', databaseUrl.replace('pooler.supabase.com', 'example.invalid'), ca))
  assert.throws(() => databaseConnectionOptions('supabase', databaseUrl, ''))
  assert.throws(() => databaseConnectionOptions('supabase-test', databaseUrl, ca))
})

async function availablePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not choose a local HTTP test port.')
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

function sanitizeServerOutput(output: string, secrets: string[]): string {
  let sanitized = output
  for (const secret of secrets) sanitized = sanitized.replaceAll(secret, '[redacted]')
  sanitized = sanitized.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database-url-redacted]')
  sanitized = sanitized.replace(/NUXT_SESSION_PASSWORD\s*[:=]\s*[^\s'"<>]+/gi, 'NUXT_SESSION_PASSWORD=[redacted]')
  return sanitized.slice(-3000).trim()
}

async function waitForHttpServer(
  child: ReturnType<typeof spawn>,
  baseUrl: string,
  serverOutput: () => string,
  secrets: string[],
): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostics = sanitizeServerOutput(serverOutput(), secrets)
      throw new Error(`Nuxt authentication test server exited with code ${child.exitCode ?? child.signalCode}.${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      const response = await fetchLocal(`${baseUrl}/api/auth/session`)
      if (response.ok) return
    } catch {}
    await delay(300)
  }
  const diagnostics = sanitizeServerOutput(serverOutput(), secrets)
  throw new Error(`Nuxt authentication test server did not become ready within 60 seconds.${diagnostics ? `\n${diagnostics}` : ''}`)
}

async function stopOwnedProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    delay(8_000),
  ])
  if (child.exitCode !== null || child.signalCode) return
  // This PID is the exact process started for this test and is never discovered from outside the task.
  const { execFileSync } = await import('node:child_process')
  execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, 'auth response should set or clear the sealed session cookie')
  return setCookie.split(';', 1)[0]!
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>
}

test('teacher login, sealed session, same-origin requests, reset revocation, and generic throttle work over HTTP', { timeout: 180_000 }, async (t) => {
  assert.equal(shouldUseSecureSessionCookie('production', 'https:', 'attendance.example.com'), true)
  assert.equal(shouldUseSecureSessionCookie('production', 'http:', 'localhost'), false)
  assert.equal(shouldUseSecureSessionCookie('production', 'http:', '127.0.0.1'), false)
  assert.equal(shouldUseSecureSessionCookie('development', 'http:', 'attendance.example.com'), false)

  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const appDatabase = postgres(temporary.runtimeUrl, { max: 3, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let secondServer: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let secondServerOutput = ''
  let isolatedNuxtRoot: string | undefined
  let secondIsolatedNuxtRoot: string | undefined

  try {
    const migrations = await runMigrations(migrator, 'up')
    const expectedNames = await listMigrationNames()
    assert.deepEqual(migrations.map((migration) => migration.name), expectedNames)
    assert.deepEqual(migrations.map((migration) => migration.applied), expectedNames.map(() => true))

    const email = `auth-${randomUUID()}@example.invalid`
    const oldPassword = randomBytes(24).toString('base64url')
    const oldHash = await passwordHasher.make(oldPassword)
    const account = await provisionTeacherAccount(migrator, email, oldHash)

    const sessionPassword = randomBytes(48).toString('base64url')
    const throttleHmacKey = randomBytes(48).toString('base64url')
    const localRuntimeUrl = new URL(temporary.runtimeUrl)
    localRuntimeUrl.search = ''
    const fixtureRuntimeUrl = localRuntimeUrl.toString()
    const baseUrls: string[] = []
    for (let instance = 0; instance < 2; instance += 1) {
      const port = await availablePort()
      const baseUrl = `http://127.0.0.1:${port}`
      const isolatedRoot = await createIsolatedNuxtRoot()
      await useLoopbackPostgresInIsolatedRoot(isolatedRoot)
      const child = spawn(process.execPath, [
        path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
        'dev',
        '--host', '127.0.0.1',
        '--port', String(port),
        '--no-fork',
        '--no-tui',
        '--strictPort',
        isolatedRoot,
      ], {
        cwd: isolatedRoot,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          NUXT_DATABASE_URL: fixtureRuntimeUrl,
          NUXT_DATABASE_MODE: 'supabase',
          NUXT_LOGIN_THROTTLE_HMAC_KEY: throttleHmacKey,
          NUXT_SESSION_PASSWORD: sessionPassword,
          VERCEL: '1',
          NUXT_TELEMETRY_DISABLED: '1',
          PORT: String(port),
          HOST: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      const collectOutput = (chunk: Buffer) => {
        if (instance === 0) serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000)
        else secondServerOutput = `${secondServerOutput}${chunk.toString('utf8')}`.slice(-16_000)
      }
      child.stdout?.on('data', collectOutput)
      child.stderr?.on('data', collectOutput)
      if (instance === 0) {
        isolatedNuxtRoot = isolatedRoot
        server = child
      } else {
        secondIsolatedNuxtRoot = isolatedRoot
        secondServer = child
      }
      const output = () => instance === 0 ? serverOutput : secondServerOutput
      await waitForHttpServer(child, baseUrl, output, [sessionPassword, throttleHmacKey, fixtureRuntimeUrl, temporary.migrationUrl])
      baseUrls.push(baseUrl)
    }
    const baseUrl = baseUrls[0]!

    await t.test('unauthenticated pages redirect and future API routes are protected by default', async () => {
      const page = await fetchLocal(`${baseUrl}/`, { redirect: 'manual' })
      assert.ok([301, 302, 303, 307, 308].includes(page.status))
      assert.equal(new URL(page.headers.get('location')!, baseUrl).pathname, '/login')
      const api = await fetchLocal(`${baseUrl}/api/future/attendance`)
      assert.equal(api.status, 401)
    })

    await t.test('unsafe requests reject missing and cross-origin Origin before changing the session', async () => {
      const mismatched = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
        body: JSON.stringify({ email, password: oldPassword }),
      })
      assert.equal(mismatched.status, 403)
      const missing = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: oldPassword }),
      })
      assert.equal(missing.status, 403)
    })

    await t.test('empty form fields return the approved field copy', async () => {
      const empty = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email: '', password: '' }),
      })
      assert.equal(empty.status, 400)
      assert.deepEqual((await jsonResponse(empty)).fieldErrors, { email: 'Masukkan alamat email.' })

      const noPassword = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: '' }),
      })
      assert.equal(noPassword.status, 400)
      assert.deepEqual((await jsonResponse(noPassword)).fieldErrors, { password: 'Masukkan kata sandi.' })
    })

    let invalidResponse: Record<string, unknown>
    await t.test('wrong known credentials and unknown email return the same generic response', async () => {
      const wrongKnown = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: randomBytes(24).toString('base64url') }),
      })
      assert.equal(wrongKnown.status, 401)
      invalidResponse = await jsonResponse(wrongKnown)

      const wrongUnknown = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email: 'missing@example.invalid', password: randomBytes(24).toString('base64url') }),
      })
      assert.equal(wrongUnknown.status, 401)
      assert.deepEqual(await jsonResponse(wrongUnknown), invalidResponse)
      assert.equal(invalidResponse.message, 'Email atau kata sandi belum cocok.')
    })

    let activeCookie = ''
    await t.test('a valid login creates a sealed HttpOnly SameSite=Lax local cookie with no sensitive response fields', async () => {
      const response = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: oldPassword }),
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await jsonResponse(response), { ok: true })
      const setCookie = response.headers.get('set-cookie')!
      assert.match(setCookie, /HttpOnly/i)
      assert.match(setCookie, /SameSite=Lax/i)
      assert.match(setCookie, /Path=\//i)
      assert.doesNotMatch(setCookie, /Secure/i, 'HTTP local development remains usable')
      assert.doesNotMatch(setCookie, new RegExp(sessionPassword))
      assert.doesNotMatch(setCookie, new RegExp(oldHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      activeCookie = cookieFrom(response)
    })

    await t.test('session output is minimal and authenticated future APIs pass the auth gate', async () => {
      const sessionResponse = await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: activeCookie } })
      assert.equal(sessionResponse.status, 200)
      const session = await jsonResponse(sessionResponse)
      assert.deepEqual(session, { authenticated: true, email })
      assert.doesNotMatch(JSON.stringify(session), /password|hash|secret|sessionVersion/i)
      assert.doesNotMatch(JSON.stringify(session), new RegExp(sessionPassword))

      const internalSession = await fetchLocal(`${baseUrl}/api/_auth/session`, { headers: { cookie: activeCookie } })
      assert.equal(internalSession.status, 200)
      const internal = await jsonResponse(internalSession)
      assert.equal((internal.user as Record<string, unknown>).id, account.id)
      assert.doesNotMatch(JSON.stringify(internal), /passwordHash|password_hash|secret/i)

      const authenticatedFuture = await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: activeCookie } })
      assert.equal(authenticatedFuture.status, 404)
      for (const path of ['/api/auth/register', '/api/auth/password-reset']) {
        const publicFeature = await fetchLocal(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: baseUrl, cookie: activeCookie },
          body: '{}',
        })
        assert.equal(publicFeature.status, 404)
      }
    })

    let secondOldDeviceCookie = ''
    await t.test('a second device gets an independent persisted session', async () => {
      const response = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: oldPassword }),
      })
      assert.equal(response.status, 200)
      secondOldDeviceCookie = cookieFrom(response)
      assert.notEqual(secondOldDeviceCookie, activeCookie)
      assert.deepEqual(await jsonResponse(await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: secondOldDeviceCookie } })), {
        authenticated: true,
        email,
      })
    })

    let newPassword = ''
    await t.test('owner reset increases the account version, carries audit actor, and revokes the old cookie', async () => {
      newPassword = randomBytes(24).toString('base64url')
      const newHash = await passwordHasher.make(newPassword)
      const reset = await resetTeacherAccountPassword(migrator, newHash)
      assert.equal(reset.id, account.id)
      assert.equal(reset.sessionVersion, account.sessionVersion + 1)

      await assert.rejects(
        createTeacherSession(appDatabase, account.id, randomUUID(), account.sessionVersion, new Date(Date.now() + 60_000)),
        /Teacher account changed while login was in progress\./,
        'A login that reaches session creation after a password reset must reject its stale version.',
      )
      const lateStaleSessionId = randomUUID()
      await migrator`
        insert into teacher_sessions (id, teacher_id, session_version, expires_at)
        values (${lateStaleSessionId}, ${account.id}, ${account.sessionVersion}, ${new Date(Date.now() + 60_000)})
      `
      const lateStaleSession = await findTeacherSession(appDatabase, account.id, lateStaleSessionId)
      assert.equal(lateStaleSession?.isSessionActive, false, 'A session inserted with a pre-reset version must be inactive on the protected-session lookup path.')

      const auditRows = await migrator<{
        actor_teacher_id: string | null
        actor_kind: string
        old_value: Record<string, unknown> | null
        new_value: Record<string, unknown> | null
      }[]>`
        select actor_teacher_id, actor_kind, old_value, new_value
        from audit_events
        where entity_type = 'teacher_accounts' and entity_id = ${account.id}
        order by id desc limit 1
      `
      assert.equal(auditRows[0]?.actor_kind, 'teacher')
      assert.equal(auditRows[0]?.actor_teacher_id, account.id)
      assert.equal(auditRows[0]?.old_value?.session_version, account.sessionVersion)
      assert.equal(auditRows[0]?.new_value?.session_version, reset.sessionVersion)
      assert.ok(!Object.hasOwn(auditRows[0]?.old_value ?? {}, 'password_hash'))
      assert.ok(!Object.hasOwn(auditRows[0]?.new_value ?? {}, 'password_hash'))

      const oldSession = await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: activeCookie } })
      assert.equal(oldSession.status, 200)
      assert.deepEqual(await jsonResponse(oldSession), { authenticated: false })
      const revokedApi = await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: activeCookie } })
      assert.equal(revokedApi.status, 401)
      const otherOldSession = await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: secondOldDeviceCookie } })
      assert.deepEqual(await jsonResponse(otherOldSession), { authenticated: false })
      const revokedOtherApi = await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: secondOldDeviceCookie } })
      assert.equal(revokedOtherApi.status, 401)

      const oldPasswordLogin = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: oldPassword }),
      })
      assert.equal(oldPasswordLogin.status, 401)
      assert.deepEqual(await jsonResponse(oldPasswordLogin), invalidResponse)

      const newPasswordLogin = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: newPassword }),
      })
      assert.equal(newPasswordLogin.status, 200)
      activeCookie = cookieFrom(newPasswordLogin)
    })

    await t.test('logout revokes only this device session while another device stays authenticated', async () => {
      const secondNewDevice = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: newPassword }),
      })
      assert.equal(secondNewDevice.status, 200)
      const secondNewDeviceCookie = cookieFrom(secondNewDevice)
      assert.notEqual(secondNewDeviceCookie, activeCookie)

      const mismatched = await fetchLocal(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { origin: 'https://attacker.invalid', cookie: activeCookie },
      })
      assert.equal(mismatched.status, 403)

      const loggedOut = await fetchLocal(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { origin: baseUrl, cookie: activeCookie },
      })
      assert.equal(loggedOut.status, 200)
      assert.deepEqual(await jsonResponse(loggedOut), { ok: true })
      const clearedCookie = cookieFrom(loggedOut)
      assert.equal(clearedCookie.includes(activeCookie.slice(activeCookie.indexOf('=') + 1)), false)
      assert.equal((await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: clearedCookie } })).status, 200)
      assert.equal((await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: activeCookie } })).status, 401)
      assert.deepEqual(await jsonResponse(await fetchLocal(`${baseUrl}/api/auth/session`, { headers: { cookie: secondNewDeviceCookie } })), {
        authenticated: true,
        email,
      })
      assert.equal((await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: secondNewDeviceCookie } })).status, 404)

      const secondLogout = await fetchLocal(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { origin: baseUrl, cookie: secondNewDeviceCookie },
      })
      assert.equal(secondLogout.status, 200)
      assert.equal((await fetchLocal(`${baseUrl}/api/future/attendance`, { headers: { cookie: secondNewDeviceCookie } })).status, 401)
    })

    await t.test('the fifth failure blocks later login attempts for this local client', async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failure = await fetchLocal(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: baseUrl },
          body: JSON.stringify({ email, password: randomBytes(24).toString('base64url') }),
        })
        assert.equal(failure.status, 401)
        assert.deepEqual(await jsonResponse(failure), invalidResponse)
      }
      const blocked = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password: newPassword }),
      })
      assert.equal(blocked.status, 429)
      assert.deepEqual(await jsonResponse(blocked), {
        ok: false,
        message: 'Terlalu banyak percobaan. Coba lagi nanti.',
      })
    })

    await t.test('concurrent shared-throttle login requests admit only five and return the 429 copy for the rest', async () => {
      await migrator`delete from private.login_throttle_attempts`
      const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => fetchLocal(`${baseUrls[index % 2]}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrls[index % 2] },
        body: JSON.stringify({ email, password: randomBytes(24).toString('base64url') }),
      })))
      assert.equal(responses.filter((response) => response.status === 401).length, 5)
      assert.equal(responses.filter((response) => response.status === 429).length, 3)
      for (const response of responses.filter((item) => item.status === 429)) {
        assert.deepEqual(await jsonResponse(response), {
          ok: false,
          message: 'Terlalu banyak percobaan. Coba lagi nanti.',
        })
      }
    })
  } finally {
    if (secondServer) await stopOwnedProcess(secondServer)
    if (server) await stopOwnedProcess(server)
    await appDatabase.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
    if (secondIsolatedNuxtRoot) await removeIsolatedNuxtRoot(secondIsolatedNuxtRoot)
  }
})
