import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import postgres from 'postgres'
import sharp from 'sharp'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { runMigrations } from '../server/database/migrate.mjs'
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { closeSemester, createSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass, createSchoolLogoAsset, setActiveSchoolLogo } from '../server/database/repositories/schools.ts'
import { LocalSchoolLogoStorage } from '../server/utils/school-logo-storage.ts'
import { createTeacherAccount } from '../server/database/repositories/teacher-accounts.ts'
import { setCalendarException, setCalendarHoliday, setRoutineSchoolDay } from '../server/database/repositories/calendar.ts'
import { recordAttendance } from '../server/database/repositories/attendance.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'
import { listMigrationNames } from './support/migration-names.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.cache', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

function fetchLocal(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) })
}

function rawSocketRequest(baseUrl: string, request: Buffer): Promise<string> {
  const address = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: address.hostname, port: Number(address.port) })
    let response = ''
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Raw HTTP test request timed out.'))
    }, requestTimeoutMs)
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      if (error && !response) reject(error)
      else resolve(response)
    }
    socket.once('connect', () => socket.write(request))
    socket.on('data', (chunk) => { response += chunk.toString('latin1') })
    socket.once('error', (error) => finish(error))
    socket.once('close', () => finish())
  })
}

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

async function createIsolatedNuxtRoot(): Promise<string> {
  await mkdir(testRoot, { recursive: true })
  const root = await mkdtemp(path.join(testRoot, 'nuxt-root-'))
  try {
    for (const entry of ['app', 'server', 'shared']) await cp(path.join(appRoot, entry), path.join(root, entry), { recursive: true })
    for (const entry of ['nuxt.config.ts', 'package.json']) await cp(path.join(appRoot, entry), path.join(root, entry))
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
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^nuxt-root-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
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

async function removeGeneratedLogoStorageRoot(root: string): Promise<void> {
  const generated = await lstat(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!generated) return
  if (!generated.isDirectory() || generated.isSymbolicLink() || !/^school-logo-http-[A-Za-z0-9]+$/.test(path.basename(root))) {
    throw new Error('Refusing to remove an unexpected logo test storage root.')
  }
  const resolved = await realpath(root)
  const parent = await realpath(path.join(appRoot, '.cache', 'tests'))
  if (path.dirname(resolved).toLowerCase() !== parent.toLowerCase() || resolved.toLowerCase() !== path.resolve(root).toLowerCase()) {
    throw new Error('Refusing to remove logo test storage outside its generated cache directory.')
  }
  await rm(resolved, { recursive: true, force: false })
}

function sanitizeServerOutput(output: string, secrets: string[]): string {
  let sanitized = output
  for (const secret of secrets) sanitized = sanitized.replaceAll(secret, '[redacted]')
  sanitized = sanitized.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[database-url-redacted]')
  sanitized = sanitized.replace(/NUXT_SESSION_PASSWORD\s*[:=]\s*[^\s'"<>]+/gi, 'NUXT_SESSION_PASSWORD=[redacted]')
  return sanitized.slice(-3000).trim()
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
  baseUrl: string,
  serverOutput: () => string,
  secrets: string[],
): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostics = sanitizeServerOutput(serverOutput(), secrets)
      throw new Error(`Nuxt STUD test server exited with code ${child.exitCode ?? child.signalCode}.${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      const response = await fetchLocal(`${baseUrl}/api/auth/session`)
      if (response.ok) return
    } catch {}
    await delay(300)
  }
  throw new Error('Nuxt STUD test server did not become ready within 60 seconds.')
}

async function stopOwnedProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise<void>((resolve) => child.once('exit', () => resolve())), delay(8_000)])
  if (child.exitCode !== null || child.signalCode) return
  execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, 'successful login should set the session cookie')
  return setCookie.split(';', 1)[0]!
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>
}

async function waitForAdvisoryLockState(
  database: postgres.Sql,
  lockClass: 1727 | 1728 | 1729,
  minimumGranted: number,
  minimumWaiting: number,
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const [state] = await database<{ granted_count: number; waiting_count: number }[]>`
      select count(*) filter (where granted)::int as granted_count,
             count(*) filter (where not granted)::int as waiting_count
      from pg_locks
      where locktype = 'advisory' and classid = ${lockClass}::oid and objsubid = 2
    `
    if (Number(state.granted_count) >= minimumGranted && Number(state.waiting_count) >= minimumWaiting) return
    await delay(25)
  }
  throw new Error(`Timed out waiting for advisory lock class ${lockClass} state.`)
}

function dateShift(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

test('migration 0008 leaves pre-existing archive logos null and supports down/up without backfill', { timeout: 60_000 }, async () => {
  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const runtime = postgres(temporary.runtimeUrl, { max: 2, connect_timeout: 5 })
  try {
    const names = await listMigrationNames()
    await migrator`create table public.schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default clock_timestamp())`
    for (const name of names.filter((name) => !name.startsWith('0008_'))) {
      await migrator.unsafe(await readFile(path.join(appRoot, 'server/database/migrations', `${name}.up.sql`), 'utf8')).simple()
    }
    const teacher = await createTeacherAccount(migrator, `legacy-${randomUUID()}@example.invalid`)
    const school = await createSchool(runtime, { teacherId: teacher.id, name: 'Legacy synthetic school' })
    await createSchoolClass(runtime, { schoolId: school.id, name: 'Legacy fixture' })
    const fixture = await createSchoolFixtureForOwner(runtime, teacher.id, school.id)
    const up = await readFile(path.join(appRoot, 'server/database/migrations/0008_school_logo_assets.up.sql'), 'utf8')
    const down = await readFile(path.join(appRoot, 'server/database/migrations/0008_school_logo_assets.down.sql'), 'utf8')
    await migrator.unsafe(up).simple()
    const [archive] = await runtime`select logo_asset_id from semester_archive_snapshots where semester_id = ${fixture.archiveSemesterId}`
    assert.equal(archive.logo_asset_id, null)
    await migrator.unsafe(down).simple()
    await migrator.unsafe(up).simple()
    const [reapplied] = await runtime`select logo_asset_id from semester_archive_snapshots where semester_id = ${fixture.archiveSemesterId}`
    assert.equal(reapplied.logo_asset_id, null)
  } finally {
    await runtime.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
  }
})

test('STUD school setup and semester roster APIs preserve ownership, snapshots, dates, audit and transactions over HTTP', { timeout: 240_000 }, async (t) => {
  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const appDatabase = postgres(temporary.runtimeUrl, { max: 5, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined
  let logoStorageRoot = ''
  let baseUrl = ''
  let ownerCookie = ''
  let ownerTeacherId = ''
  let schoolId = ''
  let schoolLogoAssetId = ''
  let replacementLogoAssetId = ''
  let archiveLogoBytes = Buffer.alloc(0)
  let activeSemesterId = ''
  let archiveSemesterId = ''
  let foreignSemesterId = ''
  let activeMembershipId = ''
  let addedMembershipId = ''
  let archiveMembershipId = ''
  let foreignMembershipId = ''
  let attendanceDate = ''
  const password = randomBytes(24).toString('base64url')

  try {
    const migrations = await runMigrations(migrator, 'up')
    const expectedNames = await listMigrationNames()
    assert.deepEqual(migrations.map((migration) => migration.name), expectedNames)
    assert.deepEqual(migrations.map((migration) => migration.applied), expectedNames.map(() => true))

    const email = `stud-${randomUUID()}@example.invalid`
    const owner = await provisionTeacherAccount(migrator, email, await passwordHasher.make(password))
    ownerTeacherId = owner.id
    const port = await availablePort()
    baseUrl = `http://127.0.0.1:${port}`
    const sessionPassword = randomBytes(48).toString('base64url')
    const cacheTestRoot = path.join(appRoot, '.cache', 'tests')
    await mkdir(cacheTestRoot, { recursive: true })
    logoStorageRoot = await mkdtemp(path.join(cacheTestRoot, 'school-logo-http-'))
    isolatedNuxtRoot = await createIsolatedNuxtRoot()
    server = spawn(process.execPath, [
      path.join(appRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
      'dev', '--host', '127.0.0.1', '--port', String(port), '--no-fork', '--no-tui', '--strictPort', isolatedNuxtRoot,
    ], {
      cwd: isolatedNuxtRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NUXT_DATABASE_URL: temporary.runtimeUrl,
        NUXT_SESSION_PASSWORD: sessionPassword,
        NUXT_TELEMETRY_DISABLED: '1',
        LAB002_FIXTURE: '1',
        LAB002_SCHOOL_LOGO_ROOT: logoStorageRoot,
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const collectOutput = (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) }
    server.stdout?.on('data', collectOutput)
    server.stderr?.on('data', collectOutput)
    await waitForServer(server, baseUrl, () => serverOutput, [password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    await t.test('anonymous reads and writes are rejected; authenticated unsafe requests require the same origin', async () => {
      for (const url of ['/api/school', '/api/semesters', '/api/students?semesterId=00000000-0000-4000-8000-000000000001']) {
        assert.equal((await fetchLocal(`${baseUrl}${url}`)).status, 401)
      }
      const anonymousWrite = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl }, body: '{}',
      })
      assert.equal(anonymousWrite.status, 401)

      const login = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password }),
      })
      assert.equal(login.status, 200)
      ownerCookie = cookieFrom(login)
      const crossOrigin = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid', cookie: ownerCookie },
        body: JSON.stringify({ name: 'Ditolak', className: 'X', timeZone: 'Asia/Jakarta' }),
      })
      assert.equal(crossOrigin.status, 403)
    })

    await t.test('school settings validate timezone, create exactly one school/class, update without trusting owner fields', async () => {
      const invalid = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sekolah Uji', className: 'Kelas A', timeZone: 'Not/A-Real-Zone' }),
      })
      assert.equal(invalid.status, 422)
      const invalidBody = await jsonResponse(invalid)
      assert.equal(invalidBody.statusMessage, 'Pilih zona waktu sekolah yang valid.')
      assert.deepEqual((invalidBody.data as Record<string, unknown>).fieldErrors, { timeZone: 'Pilih zona waktu sekolah yang valid.' })
      const invalidType = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sekolah Uji', className: 'Kelas A', timeZone: 24 }),
      })
      assert.equal(invalidType.status, 422, 'An invalid timezone type must not silently reset to the default.')
      const [beforeSetup] = await appDatabase`select count(*)::int as count from schools where teacher_id = ${ownerTeacherId}`
      assert.equal(beforeSetup.count, 0, 'Invalid metadata must not partially create a school.')

      archiveLogoBytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: { r: 31, g: 120, b: 88 } } }).png().toBuffer()
      await migrator.unsafe(`CREATE FUNCTION public.reject_initial_logo_class() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic initial create rollback'; END $$`)
      await migrator.unsafe('CREATE TRIGGER reject_initial_logo_class BEFORE INSERT ON public.school_classes FOR EACH ROW EXECUTE FUNCTION public.reject_initial_logo_class()')
      try {
        const rejectedCreate = new FormData()
        rejectedCreate.append('metadata', JSON.stringify({ name: 'Must rollback initial school', className: 'Must rollback', timeZone: 'Asia/Jakarta', logoAction: 'replace' }))
        rejectedCreate.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'initial-failure.png')
        assert.equal((await fetchLocal(`${baseUrl}/api/school`, { method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: rejectedCreate })).status, 503)
        const [partial] = await appDatabase`select (select count(*)::int from schools where teacher_id = ${ownerTeacherId}) as schools, (select count(*)::int from school_logo_assets where uploaded_by = ${ownerTeacherId}) as assets`
        assert.deepEqual(partial, { schools: 0, assets: 0 })
        assert.deepEqual(await readdir(logoStorageRoot), [])
      } finally {
        await migrator.unsafe('DROP TRIGGER reject_initial_logo_class ON public.school_classes')
        await migrator.unsafe('DROP FUNCTION public.reject_initial_logo_class()')
      }
      const initialLogoForm = new FormData()
      initialLogoForm.append('metadata', JSON.stringify({ name: 'Sekolah Uji', className: 'Kelas A', timeZone: 'Asia/Jakarta', logoAction: 'replace' }))
      initialLogoForm.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'initial-logo.png')
      const created = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: initialLogoForm,
      })
      assert.equal(created.status, 200)
      const createdBody = await jsonResponse(created)
      schoolId = ((createdBody.school as Record<string, unknown>).id as string)
      assert.equal((createdBody.school as Record<string, unknown>).timeZone, 'Asia/Jakarta')
      schoolLogoAssetId = (createdBody.school as Record<string, unknown>).logoAssetId as string

      const override = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Tidak boleh', className: 'X', timeZone: 'Asia/Jakarta', teacherId: randomUUID(), actor_id: randomUUID() }),
      })
      assert.equal(override.status, 422)
      const updated = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sekolah Baru', className: 'Kelas B', timeZone: 'Asia/Makassar' }),
      })
      assert.equal(updated.status, 200)
      const [counts] = await appDatabase`
        select (select count(*)::int from schools where teacher_id = ${ownerTeacherId}) as schools,
               (select count(*)::int from school_classes where school_id = ${schoolId}) as classes
      `
      assert.equal(counts.schools, 1)
      assert.equal(counts.classes, 1)
      const [savedSchool] = await appDatabase`select name, time_zone from schools where id = ${schoolId}`
      assert.deepEqual(savedSchool, { name: 'Sekolah Baru', time_zone: 'Asia/Makassar' })
      const fetched = await fetchLocal(`${baseUrl}/api/school`, { headers: { cookie: ownerCookie } })
      assert.equal(fetched.status, 200)
      const schoolBody = await jsonResponse(fetched)
      assert.equal((schoolBody.school as Record<string, unknown>).className, 'Kelas B')

      const uploadMetadata = { name: 'Sekolah Baru', className: 'Kelas B', timeZone: 'Asia/Makassar', logoAction: 'replace' }
      assert.match(schoolLogoAssetId, /^[0-9a-f-]{36}$/i)
      const logoResponse = await fetchLocal(`${baseUrl}/api/school/logo/${schoolLogoAssetId}`, { headers: { cookie: ownerCookie } })
      assert.equal(logoResponse.status, 200)
      assert.equal(logoResponse.headers.get('content-type'), 'image/png')
      assert.match(logoResponse.headers.get('cache-control') ?? '', /no-store/)
      assert.equal(logoResponse.headers.get('x-content-type-options'), 'nosniff')
      assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()), archiveLogoBytes)

      const malformedForm = new FormData()
      malformedForm.append('metadata', JSON.stringify(uploadMetadata))
      malformedForm.append('logo', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'broken.png')
      const malformed = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: malformedForm,
      })
      assert.equal(malformed.status, 422)
      const stillCurrent = await fetchLocal(`${baseUrl}/api/school`, { headers: { cookie: ownerCookie } })
      assert.equal(((await jsonResponse(stillCurrent)).school as Record<string, unknown>).logoAssetId, schoolLogoAssetId)

      const oversizedForm = new FormData()
      oversizedForm.append('metadata', JSON.stringify(uploadMetadata))
      oversizedForm.append('logo', new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' }), 'oversized.png')
      const oversized = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: oversizedForm,
      })
      assert.equal(oversized.status, 413)

      for (const [label, bytes, mime] of [
        ['dimension', await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'white' } }).png().toBuffer(), 'image/png'],
        ['truncated', archiveLogoBytes.subarray(0, Math.floor(archiveLogoBytes.length / 2)), 'image/png'],
        ['mime mismatch', archiveLogoBytes, 'image/jpeg'],
        ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'],
      ] as const) {
        const form = new FormData()
        form.append('metadata', JSON.stringify(uploadMetadata))
        form.append('logo', new Blob([new Uint8Array(bytes)], { type: mime }), 'edge.png')
        assert.equal((await fetchLocal(`${baseUrl}/api/school`, {
          method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: form,
        })).status, 422, label)
      }

      for (const fieldKind of ['duplicate', 'unknown', 'oversized', 'extra-file', 'missing-file', 'keep-file']) {
        const form = new FormData()
        form.append('metadata', JSON.stringify({ ...uploadMetadata, ...(fieldKind === 'keep-file' ? { logoAction: 'keep' } : {}) }))
        if (fieldKind !== 'missing-file') form.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'logo.png')
        if (fieldKind === 'duplicate') form.append('metadata', '{}')
        if (fieldKind === 'unknown') form.append('unknown', 'x')
        if (fieldKind === 'oversized') { form.delete('metadata'); form.append('metadata', 'x'.repeat(2049)) }
        if (fieldKind === 'extra-file') form.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'other.png')
        assert.equal((await fetchLocal(`${baseUrl}/api/school`, {
          method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: form,
        })).status, 422, fieldKind)
      }

      const hugeBody = Buffer.from('x'.repeat(2 * 1024 * 1024 + 64 * 1024 + 1))
      for (const contentType of ['application/json', 'multipart/form-data; boundary=edge']) {
        const headers = `PUT /api/school HTTP/1.1\r\nHost: ${new URL(baseUrl).host}\r\nOrigin: ${baseUrl}\r\nCookie: ${ownerCookie}\r\nContent-Type: ${contentType}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n`
        const chunked = Buffer.concat([Buffer.from(headers), Buffer.from(`${hugeBody.length.toString(16)}\r\n`), hugeBody, Buffer.from('\r\n0\r\n\r\n')])
        assert.match(await rawSocketRequest(baseUrl, chunked), /^HTTP\/1\.1 413 /, contentType)
      }

      const filesBeforeRollback = await readdir(logoStorageRoot)
      await migrator.unsafe(`CREATE FUNCTION public.reject_logo_test_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$`)
      await migrator.unsafe('CREATE TRIGGER reject_logo_test_save BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.reject_logo_test_save()')
      try {
        const form = new FormData()
        form.append('metadata', JSON.stringify({ ...uploadMetadata, name: 'Must rollback' }))
        form.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'rollback.png')
        const failed = await fetchLocal(`${baseUrl}/api/school`, { method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: form })
        assert.equal(failed.status, 503)
        assert.deepEqual(await readdir(logoStorageRoot), filesBeforeRollback, 'Only the newly written asset is removed on transaction failure.')
        const [unchanged] = await appDatabase`select name, active_logo_asset_id from schools where id = ${schoolId}`
        assert.equal(unchanged.name, 'Sekolah Baru')
        assert.equal(unchanged.active_logo_asset_id, schoolLogoAssetId)
      } finally {
        await migrator.unsafe('DROP TRIGGER reject_logo_test_save ON public.schools')
        await migrator.unsafe('DROP FUNCTION public.reject_logo_test_save()')
      }
    })

    await t.test('owner-scoped semester options include active and archive; fixture roster uses historical snapshots', async () => {
      const school = await createSchoolFixtureForOwner(appDatabase, ownerTeacherId, schoolId)
      activeSemesterId = school.activeSemesterId
      archiveSemesterId = school.archiveSemesterId
      activeMembershipId = school.activeMembershipId
      archiveMembershipId = school.archiveMembershipId
      attendanceDate = school.attendanceDate

      const [archiveSnapshotBeforeReplace] = await appDatabase<{ logo_asset_id: string | null }[]>`
        select logo_asset_id from semester_archive_snapshots where semester_id = ${archiveSemesterId}
      `
      assert.equal(archiveSnapshotBeforeReplace.logo_asset_id, schoolLogoAssetId)
      const replacementBytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: { r: 188, g: 81, b: 45 } } }).jpeg().toBuffer()
      const replacementForm = new FormData()
      replacementForm.append('metadata', JSON.stringify({ name: 'Sekolah Baru', className: 'Kelas B', timeZone: 'Asia/Makassar', logoAction: 'replace' }))
      replacementForm.append('logo', new Blob([new Uint8Array(replacementBytes)], { type: 'image/jpeg' }), 'second-logo.jpg')
      const replacement = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: replacementForm,
      })
      assert.equal(replacement.status, 200)
      replacementLogoAssetId = ((await jsonResponse(replacement)).school as Record<string, unknown>).logoAssetId as string
      assert.notEqual(replacementLogoAssetId, schoolLogoAssetId)
      const [activeAfterReplace] = await appDatabase<{ active_logo_asset_id: string | null }[]>`
        select active_logo_asset_id from schools where id = ${schoolId}
      `
      const [archiveAfterReplace] = await appDatabase<{ logo_asset_id: string | null }[]>`
        select logo_asset_id from semester_archive_snapshots where semester_id = ${archiveSemesterId}
      `
      assert.equal(activeAfterReplace.active_logo_asset_id, replacementLogoAssetId)
      assert.equal(archiveAfterReplace.logo_asset_id, schoolLogoAssetId)
      const replacementLogo = await fetchLocal(`${baseUrl}/api/school/logo/${replacementLogoAssetId}`, { headers: { cookie: ownerCookie } })
      assert.equal(replacementLogo.status, 200)
      assert.equal(replacementLogo.headers.get('content-type'), 'image/jpeg')
      assert.deepEqual(Buffer.from(await replacementLogo.arrayBuffer()), replacementBytes)
      const historicalLogo = await fetchLocal(`${baseUrl}/api/school/logo/${schoolLogoAssetId}`, { headers: { cookie: ownerCookie } })
      assert.equal(historicalLogo.status, 200)
      assert.deepEqual(Buffer.from(await historicalLogo.arrayBuffer()), archiveLogoBytes)

      let signalHeldLock: () => void = () => undefined
      let releaseHeldLock: () => void = () => undefined
      const lockReady = new Promise<void>((resolve) => { signalHeldLock = resolve })
      const heldLock = appDatabase.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(1728, hashtext(${schoolId}::text))`
        signalHeldLock()
        await new Promise<void>((resolve) => { releaseHeldLock = resolve })
      })
      await lockReady
      const concurrentSave = (name: string) => fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name, className: 'Kelas B', timeZone: 'Asia/Makassar' }),
      })
      const firstSave = concurrentSave('Sekolah Serentak 1')
      const secondSave = concurrentSave('Sekolah Serentak 2')
      try {
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 1)
        await waitForAdvisoryLockState(appDatabase, 1729, 1, 1)
      } finally {
        releaseHeldLock()
      }
      await heldLock
      const [firstSaveResponse, secondSaveResponse] = await Promise.all([firstSave, secondSave])
      assert.equal(firstSaveResponse.status, 200)
      assert.equal(secondSaveResponse.status, 200)

      const clearForm = new FormData()
      clearForm.append('metadata', JSON.stringify({ name: 'Sekolah Baru', className: 'Kelas B', timeZone: 'Asia/Makassar', logoAction: 'clear' }))
      const clearResponse = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: clearForm,
      })
      assert.equal(clearResponse.status, 200)
      const [clearedSchool] = await appDatabase<{ active_logo_asset_id: string | null }[]>`
        select active_logo_asset_id from schools where id = ${schoolId}
      `
      assert.equal(clearedSchool.active_logo_asset_id, null)
      assert.equal((await fetchLocal(`${baseUrl}/api/school/logo/${replacementLogoAssetId}`, { headers: { cookie: ownerCookie } })).status, 404)
      assert.equal((await fetchLocal(`${baseUrl}/api/school/logo/${schoolLogoAssetId}`, { headers: { cookie: ownerCookie } })).status, 200)

      const foreignTeacher = await createTeacherAccount(migrator, `foreign-${randomUUID()}@example.invalid`)
      const foreignSchool = await createSchool(appDatabase, { teacherId: foreignTeacher.id, name: 'Sekolah Lain' })
      const foreignClass = await createSchoolClass(appDatabase, { schoolId: foreignSchool.id, name: 'Kelas Asing' })
      const foreignLogoAssetId = randomUUID()
      const foreignLogoBytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 50, b: 110 } } }).jpeg().toBuffer()
      await new LocalSchoolLogoStorage(logoStorageRoot).write(foreignLogoAssetId, 'image/jpeg', foreignLogoBytes)
      await withAuditActor(appDatabase, foreignTeacher.id, async (transaction) => {
        await createSchoolLogoAsset(transaction, {
          assetId: foreignLogoAssetId,
          schoolId: foreignSchool.id,
          mimeType: 'image/jpeg',
          byteSize: foreignLogoBytes.length,
          width: 2,
          height: 2,
          sha256: createHash('sha256').update(foreignLogoBytes).digest('hex'),
          uploadedBy: foreignTeacher.id,
        })
        await setActiveSchoolLogo(transaction, { schoolId: foreignSchool.id, assetId: foreignLogoAssetId })
      })
      await assert.rejects(appDatabase`update schools set active_logo_asset_id = ${foreignLogoAssetId} where id = ${schoolId}`, (error: unknown) => (error as { code: string }).code === '23503')
      await assert.rejects(appDatabase`update school_logo_assets set width = 1 where id = ${schoolLogoAssetId}`, (error: unknown) => (error as { code: string }).code === '42501')
      await assert.rejects(appDatabase`delete from school_logo_assets where id = ${schoolLogoAssetId}`, (error: unknown) => (error as { code: string }).code === '42501')
      await assert.rejects(migrator`update school_logo_assets set width = 1 where id = ${schoolLogoAssetId}`, (error: unknown) => (error as { code: string }).code === '55000')
      await assert.rejects(appDatabase`update semester_archive_snapshots set logo_asset_id = ${foreignLogoAssetId} where semester_id = ${archiveSemesterId}`, (error: unknown) => ['55000', '42501'].includes((error as { code: string }).code))
      const [assetPrivileges] = await migrator`select has_table_privilege('lab002_app', 'school_logo_assets', 'SELECT') as can_read, has_table_privilege('lab002_app', 'school_logo_assets', 'INSERT') as can_insert, has_table_privilege('anon', 'school_logo_assets', 'SELECT') as anon_read, has_table_privilege('authenticated', 'school_logo_assets', 'SELECT') as authenticated_read, has_table_privilege('service_role', 'school_logo_assets', 'SELECT') as service_read`
      assert.deepEqual(assetPrivileges, { can_read: true, can_insert: true, anon_read: false, authenticated_read: false, service_read: false })
      const foreignLogoResponse = await fetchLocal(`${baseUrl}/api/school/logo/${foreignLogoAssetId}`, { headers: { cookie: ownerCookie } })
      const missingLogoResponse = await fetchLocal(`${baseUrl}/api/school/logo/${randomUUID()}`, { headers: { cookie: ownerCookie } })
      assert.equal(foreignLogoResponse.status, 404)
      assert.equal(missingLogoResponse.status, 404)
      assert.equal((await jsonResponse(foreignLogoResponse)).statusMessage, (await jsonResponse(missingLogoResponse)).statusMessage)
      const [todayRow] = await appDatabase`select school_local_today(${foreignSchool.id})::text as today`
      foreignSemesterId = (await createSemester(appDatabase, {
        schoolId: foreignSchool.id,
        academicYear: '2026/2027', term: 'ganjil',
        startsOn: dateShift(todayRow.today, -10), endsOn: dateShift(todayRow.today, 30),
      })).id
      const foreignStudent = await createStudent(appDatabase, { fullName: 'Siswa Rahasia Sekolah Lain' })
      foreignMembershipId = (await addStudentToSemester(appDatabase, {
        semesterId: foreignSemesterId,
        schoolId: foreignSchool.id,
        schoolClassId: foreignClass.id,
        studentId: foreignStudent.id,
        startsOn: dateShift(todayRow.today, -1),
      })).id

      const response = await fetchLocal(`${baseUrl}/api/semesters`, { headers: { cookie: ownerCookie } })
      assert.equal(response.status, 200)
      const result = await jsonResponse(response)
      const options = result.semesters as Record<string, unknown>[]
      assert.deepEqual(options.map((item) => item.status).sort(), ['active', 'closed'])
      assert.equal(options.some((item) => item.id === foreignSemesterId), false)

      const roster = await fetchLocal(`${baseUrl}/api/students?semesterId=${activeSemesterId}`, { headers: { cookie: ownerCookie } })
      assert.equal(roster.status, 200)
      const body = await jsonResponse(roster)
      const rows = body.students as Record<string, unknown>[]
      assert.equal(rows.length, 1)
      assert.equal(rows[0]?.fullName, 'Nama Awal')
      assert.equal(rows[0]?.gender, 'P')
      assert.equal(rows[0]?.membershipId, activeMembershipId)
      const archive = await fetchLocal(`${baseUrl}/api/students?semesterId=${archiveSemesterId}`, { headers: { cookie: ownerCookie } })
      assert.equal(archive.status, 200)
      assert.equal(((await jsonResponse(archive)).semester as Record<string, unknown>).status, 'closed')
      const byNumber = await fetchLocal(`${baseUrl}/api/students?semesterId=${activeSemesterId}&search=00042`, { headers: { cookie: ownerCookie } })
      assert.equal(byNumber.status, 200)
      assert.equal(((await jsonResponse(byNumber)).students as Record<string, unknown>[]).length, 1)

      const foreignRead = await fetchLocal(`${baseUrl}/api/students?semesterId=${foreignSemesterId}`, { headers: { cookie: ownerCookie } })
      assert.equal(foreignRead.status, 404)
    })

    await t.test('student create allows blank optionals and duplicate names, rejects bad periods/override fields atomically', async () => {
      const before = await appDatabase<{ students: number; memberships: number }[]>`
        select (select count(*)::int from students) as students,
               (select count(*)::int from semester_memberships) as memberships
      `
      const invalid = await fetchLocal(`${baseUrl}/api/students`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ semesterId: activeSemesterId, fullName: 'Siswa Invalid', startsOn: dateShift(attendanceDate, -90) }),
      })
      assert.equal(invalid.status, 422)
      const afterInvalid = await appDatabase<{ students: number; memberships: number }[]>`
        select (select count(*)::int from students) as students,
               (select count(*)::int from semester_memberships) as memberships
      `
      assert.deepEqual(afterInvalid[0], before[0], 'Invalid membership dates must roll back both student and membership.')

      await migrator.unsafe(`
        create function public.stud_test_fail_membership_insert()
        returns trigger language plpgsql as $$
        begin
          if new.name_snapshot = 'Transaksi Uji Gagal' then
            raise exception 'synthetic membership failure' using errcode = 'P0001';
          end if;
          return new;
        end
        $$;
        create trigger zz_stud_test_fail_membership_insert
          before insert on public.semester_memberships
          for each row execute function public.stud_test_fail_membership_insert();
      `).simple()
      try {
        const failedTransaction = await fetchLocal(`${baseUrl}/api/students`, {
          method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ semesterId: activeSemesterId, fullName: 'Transaksi Uji Gagal' }),
        })
        assert.equal(failedTransaction.status, 503)
        const afterFailure = await appDatabase<{ students: number; memberships: number }[]>`
          select (select count(*)::int from students) as students,
                 (select count(*)::int from semester_memberships) as memberships
        `
        assert.deepEqual(afterFailure[0], before[0], 'A failed membership insert must roll back the preceding student and audit insert.')
      } finally {
        await migrator.unsafe(`
          drop trigger if exists zz_stud_test_fail_membership_insert on public.semester_memberships;
          drop function if exists public.stud_test_fail_membership_insert();
        `).simple()
      }

      const override = await fetchLocal(`${baseUrl}/api/students`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ semesterId: activeSemesterId, fullName: 'Ditolak', school_id: randomUUID(), actorId: randomUUID() }),
      })
      assert.equal(override.status, 422)

      const added = await fetchLocal(`${baseUrl}/api/students`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ semesterId: activeSemesterId, fullName: 'Nama Awal', studentNumber: '', gender: '', startsOn: attendanceDate, endsOn: '' }),
      })
      assert.equal(added.status, 200)
      const addedBody = await jsonResponse(added)
      assert.equal(typeof addedBody.membershipId, 'string')
      addedMembershipId = addedBody.membershipId as string
      const [duplicate] = await appDatabase`
        select count(*)::int as count from semester_memberships
        where semester_id = ${activeSemesterId} and name_snapshot = 'Nama Awal'
      `
      assert.equal(duplicate.count, 2, 'Equal names remain separate people.')
      const [blankValues] = await appDatabase`
        select student.student_number, student.gender
        from semester_memberships as membership join students as student on student.id = membership.student_id
        where membership.id = ${addedBody.membershipId as string}
      `
      assert.equal(blankValues.student_number, null)
      assert.equal(blankValues.gender, null)

      const foreignSemesterWrite = await fetchLocal(`${baseUrl}/api/students`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ semesterId: foreignSemesterId, fullName: 'Tidak boleh lintas sekolah' }),
      })
      assert.equal(foreignSemesterWrite.status, 404)
    })

    await t.test('active identity edit keeps archive snapshot, inclusive end is allowed, and attendance/closed guards roll back', async () => {
      const changed = await fetchLocal(`${baseUrl}/api/students/${activeMembershipId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ fullName: 'Nama Diperbarui', studentNumber: '00127', gender: 'L', startsOn: dateShift(attendanceDate, -2), endsOn: attendanceDate }),
      })
      assert.equal(changed.status, 200)
      const [activeSnapshot] = await appDatabase`select name_snapshot, student_number_snapshot, gender_snapshot, ends_on::text as ends_on from semester_memberships where id = ${activeMembershipId}`
      const [archiveSnapshot] = await appDatabase`select name_snapshot, student_number_snapshot, gender_snapshot from semester_memberships where id = ${archiveMembershipId}`
      assert.deepEqual(activeSnapshot, { name_snapshot: 'Nama Diperbarui', student_number_snapshot: '00127', gender_snapshot: 'L', ends_on: attendanceDate })
      assert.deepEqual(archiveSnapshot, { name_snapshot: 'Nama Awal', student_number_snapshot: '00042', gender_snapshot: 'P' })

      const excludedAttendance = await fetchLocal(`${baseUrl}/api/students/${activeMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ fullName: 'Tidak Tersimpan', endsOn: dateShift(attendanceDate, -1) }),
      })
      assert.equal(excludedAttendance.status, 409)
      const [unchanged] = await appDatabase`select student.full_name, membership.ends_on::text as ends_on from semester_memberships as membership join students as student on student.id=membership.student_id where membership.id=${activeMembershipId}`
      assert.deepEqual(unchanged, { full_name: 'Nama Diperbarui', ends_on: attendanceDate }, 'Rejected date edits cannot partially change the student identity.')

      const archiveWrite = await fetchLocal(`${baseUrl}/api/students/${archiveMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ fullName: 'Arsip Berubah' }),
      })
      assert.equal(archiveWrite.status, 409)
      const archiveRoster = await fetchLocal(`${baseUrl}/api/students?semesterId=${archiveSemesterId}`, { headers: { cookie: ownerCookie } })
      const archiveRows = (await jsonResponse(archiveRoster)).students as Record<string, unknown>[]
      assert.equal(archiveRows[0]?.fullName, 'Nama Awal')

      const foreignMembershipWrite = await fetchLocal(`${baseUrl}/api/students/${foreignMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ fullName: 'Tidak boleh mengubah milik lain' }),
      })
      assert.equal(foreignMembershipWrite.status, 404)
    })

    await t.test('every school/student write records authenticated actor and never adds partial data after invalid types', async () => {
      const invalidType = await fetchLocal(`${baseUrl}/api/students/${activeMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ studentNumber: { wrong: true } }),
      })
      assert.equal(invalidType.status, 422)

      const actorRows = await appDatabase<{
        actor_teacher_id: string | null
        actor_kind: string
        entity_type: string
        old_value: Record<string, unknown> | null
        new_value: Record<string, unknown> | null
      }[]>`
        select actor_teacher_id, actor_kind, entity_type, old_value, new_value
        from audit_events
        where entity_type in ('schools', 'school_classes', 'students', 'semester_memberships')
        order by id
      `
      assert.ok(actorRows.some((row) => row.entity_type === 'schools' && row.actor_teacher_id === ownerTeacherId && row.actor_kind === 'teacher'))
      assert.ok(actorRows.some((row) => row.entity_type === 'semester_memberships' && row.actor_teacher_id === ownerTeacherId))
      for (const row of actorRows.filter((item) => item.actor_teacher_id === ownerTeacherId)) {
        for (const value of [row.old_value, row.new_value]) {
          if (value) assert.equal(Object.keys(value).some((key) => /password|secret|token|session/i.test(key)), false)
        }
      }
      assert.equal(JSON.stringify(actorRows).includes(password), false)
      assert.equal(serverOutput.includes(temporary.runtimeUrl), false)
    })

    await t.test('SEM APIs validate periods, confirm stale-safe closure, archive snapshots, and copy the end-date roster', async () => {
      const listResponse = await fetchLocal(`${baseUrl}/api/semesters`, { headers: { cookie: ownerCookie } })
      assert.equal(listResponse.status, 200)
      const listBody = await jsonResponse(listResponse)
      const initialSemesters = listBody.semesters as Record<string, unknown>[]
      const active = initialSemesters.find((semester) => semester.id === activeSemesterId)
      assert.ok(active)
      assert.equal(active.academicYear, '2026/2027')
      assert.equal(active.term, 'ganjil')
      assert.equal(active.schoolName, 'Sekolah Baru')
      assert.equal(active.className, 'Kelas B')

      const previewResponse = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(previewResponse.status, 200)
      const initialPreview = (await jsonResponse(previewResponse)).preview as Record<string, unknown>
      assert.equal(initialPreview.calendarConfigured, true)
      assert.ok(Number(initialPreview.schoolDayCount) > 0)
      assert.ok(Number(initialPreview.blankCellCount) > 0)
      assert.ok(Number(initialPreview.incompleteSchoolDayCount) > 0)

      const invalidAcademicYear = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2026/2028', term: 'genap', startsOn: dateShift(active.endsOn as string, 1),
          endsOn: dateShift(active.endsOn as string, 30), rosterSource: 'empty',
        }),
      })
      assert.equal(invalidAcademicYear.status, 422)
      const invalidYearBody = await jsonResponse(invalidAcademicYear)
      assert.equal(typeof ((invalidYearBody.data as Record<string, unknown>).fieldErrors as Record<string, unknown>).academicYear, 'string')

      const blockedSecondActive = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2027/2028', term: 'ganjil', startsOn: dateShift(active.endsOn as string, 1),
          endsOn: dateShift(active.endsOn as string, 60), rosterSource: 'empty',
        }),
      })
      assert.equal(blockedSecondActive.status, 409, 'A school cannot start the next semester while one is still active.')

      const excludeMembership = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: active.academicYear,
          term: active.term,
          startsOn: attendanceDate,
          endsOn: active.endsOn,
        }),
      })
      assert.equal(excludeMembership.status, 409)
      assert.equal(((await jsonResponse(excludeMembership)).data as Record<string, unknown>).reason, 'membership_period_conflict')
      const [unchangedSemesterPeriod] = await appDatabase`
        select starts_on::text as starts_on, ends_on::text as ends_on
        from semesters where id = ${activeSemesterId}
      `
      assert.deepEqual(unchangedSemesterPeriod, { starts_on: active.startsOn, ends_on: active.endsOn })
      const [unchangedMembershipPeriod] = await appDatabase`
        select starts_on::text as starts_on, ends_on::text as ends_on
        from semester_memberships where id = ${activeMembershipId}
      `
      assert.deepEqual(unchangedMembershipPeriod, {
        starts_on: dateShift(attendanceDate, -2),
        ends_on: attendanceDate,
      }, 'Rejected semester date changes do not move student dates automatically.')

      const shortenMembershipOne = await fetchLocal(`${baseUrl}/api/students/${activeMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ startsOn: dateShift(attendanceDate, -2), endsOn: '' }),
      })
      assert.equal(shortenMembershipOne.status, 200)
      const extendMembershipTwo = await fetchLocal(`${baseUrl}/api/students/${addedMembershipId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ startsOn: dateShift(attendanceDate, -2), endsOn: '' }),
      })
      assert.equal(extendMembershipTwo.status, 200)

      const periodFields = {
        academicYear: active.academicYear,
        term: active.term,
        startsOn: active.startsOn,
        endsOn: dateShift(attendanceDate, -1),
      }
      const excludedEffectiveAttendance = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify(periodFields),
      })
      assert.equal(excludedEffectiveAttendance.status, 409)
      assert.equal(((await jsonResponse(excludedEffectiveAttendance)).data as Record<string, unknown>).reason, 'attendance_period_conflict')

      await withAuditActor(appDatabase, ownerTeacherId, (transaction) => setCalendarHoliday(transaction, {
        schoolId,
        date: attendanceDate,
        confirmedAttendanceImpact: true,
      }))
      const [excludedHistory] = await appDatabase`
        select count(*)::int as count from attendance_records
        where semester_id = ${activeSemesterId} and attendance_date = ${attendanceDate} and is_effective = false
      `
      assert.equal(excludedHistory.count, 1)
      const excludedAttendanceHistory = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify(periodFields),
      })
      assert.equal(excludedAttendanceHistory.status, 409)
      assert.equal(((await jsonResponse(excludedAttendanceHistory)).data as Record<string, unknown>).reason, 'attendance_period_conflict')

      const foreignPreview = await fetchLocal(`${baseUrl}/api/semesters/${foreignSemesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(foreignPreview.status, 404)

      async function addRosterMember(fullName: string, endsOn: string) {
        const response = await fetchLocal(`${baseUrl}/api/students`, {
          method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ semesterId: activeSemesterId, fullName, startsOn: attendanceDate, endsOn }),
        })
        assert.equal(response.status, 200)
        return (await jsonResponse(response)).membershipId as string
      }
      const enrolledThroughLastDay = await addRosterMember('Masih Terdaftar Sampai Akhir', active.endsOn as string)
      const leftBeforeLastDay = await addRosterMember('Sudah Keluar Sebelum Akhir', dateShift(active.endsOn as string, -1))

      const staleBasePreviewResponse = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(staleBasePreviewResponse.status, 200)
      const staleBasePreview = (await jsonResponse(staleBasePreviewResponse)).preview as Record<string, unknown>
      const staleToken = staleBasePreview.previewToken as string
      await withAuditActor(appDatabase, ownerTeacherId, (transaction) => setCalendarException(transaction, {
        schoolId,
        date: dateShift(attendanceDate, -1),
        kind: 'school_day',
        note: 'Perubahan setelah pratinjau penutupan',
      }))
      const confirmedTooEarly = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}/close`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ previewToken: staleToken, confirmed: false }),
      })
      assert.equal(confirmedTooEarly.status, 422)

      const staleClose = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}/close`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ previewToken: staleToken, confirmed: true }),
      })
      assert.equal(staleClose.status, 409)
      const staleCloseBody = await jsonResponse(staleClose)
      const staleCloseData = staleCloseBody.data as Record<string, unknown>
      assert.equal(staleCloseData.reason, 'preview_changed')
      const currentPreview = staleCloseData.preview as Record<string, unknown>
      assert.notEqual(currentPreview.previewToken, staleToken)
      assert.ok(Number(currentPreview.blankCellCount) > 0)

      const closedResponse = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}/close`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ previewToken: currentPreview.previewToken, confirmed: true }),
      })
      assert.equal(closedResponse.status, 200)
      const closedBody = await jsonResponse(closedResponse)
      const closedPreview = closedBody.preview as Record<string, unknown>
      assert.equal((closedPreview.semester as Record<string, unknown>).status, 'closed')
      const [archiveDetails] = await appDatabase`
        select school_name, class_name, academic_year, term, starts_on::text as starts_on, ends_on::text as ends_on
        from semester_archive_snapshots where semester_id = ${activeSemesterId}
      `
      assert.deepEqual(archiveDetails, {
        school_name: 'Sekolah Baru',
        class_name: 'Kelas B',
        academic_year: '2026/2027',
        term: 'ganjil',
        starts_on: active.startsOn,
        ends_on: active.endsOn,
      })

      const archivedEdit = await fetchLocal(`${baseUrl}/api/semesters/${activeSemesterId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ ...periodFields, endsOn: active.endsOn }),
      })
      assert.equal(archivedEdit.status, 409)
      const renamedSchool = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sekolah Setelah Arsip', className: 'Kelas C', timeZone: 'Asia/Makassar' }),
      })
      assert.equal(renamedSchool.status, 200)
      const archivedListResponse = await fetchLocal(`${baseUrl}/api/semesters`, { headers: { cookie: ownerCookie } })
      const archivedList = (await jsonResponse(archivedListResponse)).semesters as Record<string, unknown>[]
      const immutableArchive = archivedList.find((semester) => semester.id === activeSemesterId)
      assert.equal(immutableArchive?.schoolName, 'Sekolah Baru')
      assert.equal(immutableArchive?.className, 'Kelas B')

      const nextStart = dateShift(active.endsOn as string, 1)
      const nextEnd = dateShift(nextStart, 60)
      const createdCopied = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2026/2027', term: 'genap', startsOn: nextStart, endsOn: nextEnd, rosterSource: 'previous',
        }),
      })
      assert.equal(createdCopied.status, 200)
      const copiedBody = await jsonResponse(createdCopied)
      const copiedSemester = copiedBody.semester as Record<string, unknown>
      const copiedRoster = copiedBody.roster as Record<string, unknown>
      assert.equal(copiedRoster.source, 'previous')
      assert.equal(copiedRoster.copiedCount, 3)
      assert.equal((copiedRoster.previousSemester as Record<string, unknown>).id, activeSemesterId)
      const copiedSemesterId = copiedSemester.id as string
      const [copiedRows] = await appDatabase`
        select count(*)::int as count from semester_memberships where semester_id = ${copiedSemesterId}
      `
      const [copiedAttendance] = await appDatabase`
        select count(*)::int as count from attendance_records where semester_id = ${copiedSemesterId}
      `
      assert.equal(copiedRows.count, 3, 'End-date membership uses an inclusive boundary; the student who left the day before is not copied.')
      assert.equal(copiedAttendance.count, 0, 'Roster copying never copies attendance history.')
      const [targetPeriod] = await appDatabase`
        select min(starts_on)::text as first_membership_start
        from semester_memberships where semester_id = ${copiedSemesterId}
      `
      assert.equal(targetPeriod.first_membership_start, nextStart)

      const activePeriodEdit = await fetchLocal(`${baseUrl}/api/semesters/${copiedSemesterId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2026/2027', term: 'genap', startsOn: dateShift(nextStart, 1), endsOn: nextEnd,
        }),
      })
      assert.equal(activePeriodEdit.status, 409)
      assert.equal(((await jsonResponse(activePeriodEdit)).data as Record<string, unknown>).reason, 'membership_period_conflict')
      const secondActive = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2027/2028', term: 'ganjil', startsOn: dateShift(nextEnd, 1),
          endsOn: dateShift(nextEnd, 90), rosterSource: 'empty',
        }),
      })
      assert.equal(secondActive.status, 409)

      const nextPreviewResponse = await fetchLocal(`${baseUrl}/api/semesters/${copiedSemesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(nextPreviewResponse.status, 200)
      const nextPreview = (await jsonResponse(nextPreviewResponse)).preview as Record<string, unknown>
      const closeCopied = await fetchLocal(`${baseUrl}/api/semesters/${copiedSemesterId}/close`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ previewToken: nextPreview.previewToken, confirmed: true }),
      })
      assert.equal(closeCopied.status, 200)

      const overlapAfterClose = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2028/2029', term: 'ganjil', startsOn: nextStart, endsOn: nextEnd, rosterSource: 'empty',
        }),
      })
      assert.equal(overlapAfterClose.status, 409, 'A closed semester period still prevents a new overlapping period.')

      const createdEmpty = await fetchLocal(`${baseUrl}/api/semesters`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({
          academicYear: '2027/2028', term: 'ganjil', startsOn: dateShift(nextEnd, 1),
          endsOn: dateShift(nextEnd, 90), rosterSource: 'empty',
        }),
      })
      assert.equal(createdEmpty.status, 200)
      const emptyBody = await jsonResponse(createdEmpty)
      assert.equal((emptyBody.roster as Record<string, unknown>).copiedCount, 0)
      const emptySemesterId = (emptyBody.semester as Record<string, unknown>).id as string
      const [emptyMemberships] = await appDatabase`
        select count(*)::int as count from semester_memberships where semester_id = ${emptySemesterId}
      `
      assert.equal(emptyMemberships.count, 0)

      const raceSemesterStart = dateShift(nextEnd, 1)
      const raceStudentResponse = await fetchLocal(`${baseUrl}/api/students`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ semesterId: emptySemesterId, fullName: 'Siswa Uji Urutan Lock', startsOn: raceSemesterStart }),
      })
      assert.equal(raceStudentResponse.status, 200)
      const raceMembershipId = (await jsonResponse(raceStudentResponse)).membershipId as string
      const racePreviewResponse = await fetchLocal(`${baseUrl}/api/semesters/${emptySemesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(racePreviewResponse.status, 200)
      const racePreview = (await jsonResponse(racePreviewResponse)).preview as Record<string, unknown>

      let releaseCalendarGate!: () => void
      let signalCalendarGateReady!: () => void
      const releaseCalendarGatePromise = new Promise<void>((resolve) => { releaseCalendarGate = resolve })
      const calendarGateReady = new Promise<void>((resolve) => { signalCalendarGateReady = resolve })
      const calendarGate = appDatabase.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(1727, hashtext(${schoolId}::text))`
        signalCalendarGateReady()
        await releaseCalendarGatePromise
      })
      await calendarGateReady

      let closeRace: Promise<Response> | undefined
      let membershipEditRace: Promise<Response> | undefined
      let logoSaveRace: Promise<Response> | undefined
      let raceSetupError: unknown
      try {
        closeRace = fetchLocal(`${baseUrl}/api/semesters/${emptySemesterId}/close`, {
          method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ previewToken: racePreview.previewToken, confirmed: true }),
        })
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 0)
        await waitForAdvisoryLockState(appDatabase, 1727, 1, 1)
        membershipEditRace = fetchLocal(`${baseUrl}/api/students/${raceMembershipId}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ endsOn: raceSemesterStart }),
        })
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 1)
        const raceLogoForm = new FormData()
        raceLogoForm.append('metadata', JSON.stringify({ name: 'Sekolah Setelah Arsip', className: 'Kelas C', timeZone: 'Asia/Makassar', logoAction: 'replace' }))
        raceLogoForm.append('logo', new Blob([new Uint8Array(archiveLogoBytes)], { type: 'image/png' }), 'race-logo.png')
        logoSaveRace = fetchLocal(`${baseUrl}/api/school`, {
          method: 'PUT', headers: { origin: baseUrl, cookie: ownerCookie }, body: raceLogoForm,
        })
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 2)
      } catch (error) {
        raceSetupError = error
      } finally {
        releaseCalendarGate()
      }
      await calendarGate
      if (raceSetupError) {
        await Promise.allSettled([closeRace, membershipEditRace, logoSaveRace].filter((request): request is Promise<Response> => Boolean(request)))
        throw raceSetupError
      }
      assert.ok(closeRace)
      assert.ok(membershipEditRace)
      const [raceCloseResponse, raceMembershipEditResponse] = await Promise.all([closeRace, membershipEditRace])
      assert.equal(raceCloseResponse.status, 200, 'Closure must proceed after the calendar lock is released without a deadlock.')
      assert.equal(raceMembershipEditResponse.status, 409, 'A membership edit queued behind closure must observe the archived semester.')
      assert.ok(logoSaveRace)
      const raceLogoResponse = await logoSaveRace
      assert.equal(raceLogoResponse.status, 200, 'Logo save queued behind closure completes without deadlock.')
      const raceLogoId = ((await jsonResponse(raceLogoResponse)).school as Record<string, unknown>).logoAssetId
      assert.ok(raceLogoId)
      const [raceArchive] = await appDatabase`select logo_asset_id from semester_archive_snapshots where semester_id = ${emptySemesterId}`
      assert.equal(raceArchive.logo_asset_id, null, 'Closure preserves the pre-save null logo, not the queued replacement.')
      const [raceMembershipAfterClose] = await appDatabase`
        select ends_on::text as ends_on from semester_memberships where id = ${raceMembershipId}
      `
      assert.equal(raceMembershipAfterClose.ends_on, null, 'The queued STUD edit must not mutate the closed semester.')

      const semesterAudit = await appDatabase<{ actor_teacher_id: string | null; entity_type: string; entity_id: string; new_value: Record<string, unknown> | null }[]>`
        select actor_teacher_id, entity_type, entity_id, new_value from audit_events
        where (entity_type = 'semesters' and entity_id in (${activeSemesterId}, ${copiedSemesterId}))
           or (entity_type = 'semester_archive_snapshots'
               and new_value ->> 'semester_id' in (${activeSemesterId}, ${copiedSemesterId}))
      `
      assert.ok(semesterAudit.some((row) => row.entity_type === 'semesters' && row.entity_id === activeSemesterId && row.actor_teacher_id === ownerTeacherId))
      assert.ok(semesterAudit.some((row) => row.entity_type === 'semester_archive_snapshots' && row.new_value?.semester_id === activeSemesterId && row.actor_teacher_id === ownerTeacherId))
      assert.equal(JSON.stringify(semesterAudit).includes('previewToken'), false)
    })
  } finally {
    if (server) await stopOwnedProcess(server)
    await appDatabase.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
    if (logoStorageRoot) await removeGeneratedLogoStorageRoot(logoStorageRoot)
  }
})

async function createSchoolFixtureForOwner(
  database: postgres.Sql,
  teacherId: string,
  schoolId: string,
): Promise<{
  activeSemesterId: string
  archiveSemesterId: string
  activeMembershipId: string
  archiveMembershipId: string
  attendanceDate: string
}> {
  const [todayRow] = await database`select school_local_today(${schoolId})::text as today`
  const today = todayRow.today as string
  const schoolClass = (await database<{ id: string }[]>`select id from school_classes where school_id = ${schoolId}`)[0]
  assert.ok(schoolClass)
  const student = await createStudent(database, { fullName: 'Nama Awal', studentNumber: '00042', gender: 'P' })
  const archiveSemester = await createSemester(database, {
    schoolId, academicYear: '2025/2026', term: 'ganjil',
    startsOn: dateShift(today, -180), endsOn: dateShift(today, -120),
  })
  const archiveMembership = await addStudentToSemester(database, {
    semesterId: archiveSemester.id,
    schoolId,
    schoolClassId: schoolClass.id,
    studentId: student.id,
    startsOn: dateShift(today, -180),
    endsOn: dateShift(today, -120),
  })
  const archivePreview = await getSemesterClosurePreview(database, {
    semesterId: archiveSemester.id,
    teacherId,
  })
  assert.ok(archivePreview)
  await withAuditActor(database, teacherId, (transaction) => closeSemester(transaction, {
    semesterId: archiveSemester.id,
    teacherId,
    previewToken: archivePreview.previewToken,
    confirmed: true,
  }))

  const activeSemester = await createSemester(database, {
    schoolId, academicYear: '2026/2027', term: 'ganjil',
    startsOn: dateShift(today, -30), endsOn: dateShift(today, 60),
  })
  const activeMembership = await addStudentToSemester(database, {
    semesterId: activeSemester.id,
    schoolId,
    schoolClassId: schoolClass.id,
    studentId: student.id,
    startsOn: dateShift(today, -5),
  })
  for (let weekday = 0; weekday < 7; weekday += 1) {
    await setRoutineSchoolDay(database, {
      schoolId,
      dayOfWeek: weekday,
      effectiveFrom: dateShift(today, -30),
      isSchoolDay: weekday >= 1 && weekday <= 5,
    })
  }
  const attendanceDate = dateShift(today, -1)
  await setCalendarException(database, { schoolId, date: attendanceDate, kind: 'school_day', note: 'Data pengujian sintetis' })
  await withAuditActor(database, teacherId, (transaction) => recordAttendance(transaction, {
    membershipId: activeMembership.id,
    semesterId: activeSemester.id,
    date: attendanceDate,
    status: 'H',
  }))

  return {
    activeSemesterId: activeSemester.id,
    archiveSemesterId: archiveSemester.id,
    activeMembershipId: activeMembership.id,
    archiveMembershipId: archiveMembership.id,
    attendanceDate,
  }
}
