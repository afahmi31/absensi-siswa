import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, realpath, rm, symlink, unlink } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount, resetTeacherAccountPassword } from '../server/auth/account-admin.ts'
import { isLoginBlocked, recordLoginFailure } from '../server/auth/login-throttle.ts'
import { shouldUseSecureSessionCookie } from '../server/auth/session-cookie.ts'
import { findTeacherSession } from '../server/database/repositories/teacher-accounts.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.data', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

function fetchLocal(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) })
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
  throw new Error('Nuxt authentication test server did not become ready within 60 seconds.')
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
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined

  try {
    const migrations = await runMigrations(migrator, 'up')
    assert.deepEqual(migrations.map((migration) => migration.applied), [true, true])

    const email = `auth-${randomUUID()}@example.invalid`
    const oldPassword = randomBytes(24).toString('base64url')
    const oldHash = await passwordHasher.make(oldPassword)
    const account = await provisionTeacherAccount(appDatabase, email, oldHash)

    const port = await availablePort()
    const baseUrl = `http://127.0.0.1:${port}`
    const sessionPassword = randomBytes(48).toString('base64url')
    isolatedNuxtRoot = await createIsolatedNuxtRoot()
    server = spawn(process.execPath, [
      path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
      'dev',
      '--host', '127.0.0.1',
      '--port', String(port),
      '--no-fork',
      '--no-tui',
      '--strictPort',
      isolatedNuxtRoot,
    ], {
      cwd: isolatedNuxtRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NUXT_DATABASE_URL: temporary.runtimeUrl,
        NUXT_SESSION_PASSWORD: sessionPassword,
        NUXT_TELEMETRY_DISABLED: '1',
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const collectOutput = (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000)
    }
    server.stdout?.on('data', collectOutput)
    server.stderr?.on('data', collectOutput)
    await waitForHttpServer(server, baseUrl, () => serverOutput, [sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

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
      const reset = await resetTeacherAccountPassword(appDatabase, newHash)
      assert.equal(reset.id, account.id)
      assert.equal(reset.sessionVersion, account.sessionVersion + 1)

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
  } finally {
    if (server) await stopOwnedProcess(server)
    await appDatabase.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
  }
})
