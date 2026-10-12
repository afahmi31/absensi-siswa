import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
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
import { provisionTeacherAccount } from '../server/auth/account-admin.ts'
import { withAuditActor } from '../server/database/audit-context.ts'
import { closeSemester, createSemester } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass } from '../server/database/repositories/schools.ts'
import { createTeacherAccount } from '../server/database/repositories/teacher-accounts.ts'
import { setCalendarException } from '../server/database/repositories/calendar.ts'
import { recordAttendance } from '../server/database/repositories/attendance.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.data', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

function fetchLocal(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) })
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

function dateShift(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

test('STUD school setup and semester roster APIs preserve ownership, snapshots, dates, audit and transactions over HTTP', { timeout: 240_000 }, async (t) => {
  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const appDatabase = postgres(temporary.runtimeUrl, { max: 5, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined
  let baseUrl = ''
  let ownerCookie = ''
  let ownerTeacherId = ''
  let schoolId = ''
  let activeSemesterId = ''
  let archiveSemesterId = ''
  let foreignSemesterId = ''
  let activeMembershipId = ''
  let archiveMembershipId = ''
  let foreignMembershipId = ''
  let attendanceDate = ''
  const password = randomBytes(24).toString('base64url')

  try {
    const migrations = await runMigrations(migrator, 'up')
    assert.deepEqual(migrations.map((migration) => migration.applied), [true, true])

    const email = `stud-${randomUUID()}@example.invalid`
    const owner = await provisionTeacherAccount(appDatabase, email, await passwordHasher.make(password))
    ownerTeacherId = owner.id
    const port = await availablePort()
    baseUrl = `http://127.0.0.1:${port}`
    const sessionPassword = randomBytes(48).toString('base64url')
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

      const created = await fetchLocal(`${baseUrl}/api/school`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sekolah Uji', className: 'Kelas A', timeZone: 'Asia/Jakarta' }),
      })
      assert.equal(created.status, 200)
      const createdBody = await jsonResponse(created)
      schoolId = ((createdBody.school as Record<string, unknown>).id as string)
      assert.equal((createdBody.school as Record<string, unknown>).timeZone, 'Asia/Jakarta')

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
    })

    await t.test('owner-scoped semester options include active and archive; fixture roster uses historical snapshots', async () => {
      const school = await createSchoolFixtureForOwner(appDatabase, ownerTeacherId, schoolId)
      activeSemesterId = school.activeSemesterId
      archiveSemesterId = school.archiveSemesterId
      activeMembershipId = school.activeMembershipId
      archiveMembershipId = school.archiveMembershipId
      attendanceDate = school.attendanceDate

      const foreignTeacher = await createTeacherAccount(appDatabase, `foreign-${randomUUID()}@example.invalid`)
      const foreignSchool = await createSchool(appDatabase, { teacherId: foreignTeacher.id, name: 'Sekolah Lain' })
      const foreignClass = await createSchoolClass(appDatabase, { schoolId: foreignSchool.id, name: 'Kelas Asing' })
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
  } finally {
    if (server) await stopOwnedProcess(server)
    await appDatabase.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
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
  await withAuditActor(database, teacherId, (transaction) => closeSemester(transaction, archiveSemester.id))

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
