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
import { AttendanceDayError, getAttendanceDayView } from '../server/database/repositories/attendance-days.ts'
import { closeSemester, createSemester, getSemesterClosurePreview } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass } from '../server/database/repositories/schools.ts'
import { createTeacherAccount } from '../server/database/repositories/teacher-accounts.ts'
import { saveSchoolRoutine, setCalendarException } from '../server/database/repositories/calendar.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'
import { listMigrationNames } from './support/migration-names.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.data', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

interface AttendanceFixture {
  teacherId: string
  email: string
  password: string
  schoolId: string
  classId: string
  semesterId: string
  today: string
  semesterStart: string
  semesterEnd: string
  memberOneId: string
  memberTwoId: string
  memberFutureId: string
  memberEndedId: string
}

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
  const root = await mkdtemp(path.join(testRoot, 'attendance-nuxt-root-'))
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
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^attendance-nuxt-root-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new Error('Refusing to remove an isolated Nuxt project outside the generated attendance test directory.')
  }
  const modulesPath = path.join(resolved, 'node_modules')
  const modulesInfo = await lstat(modulesPath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (modulesInfo) {
    if (!modulesInfo.isSymbolicLink()) throw new Error('Refusing to remove an isolated project with an unexpected node_modules path.')
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
      throw new Error(`Nuxt ATT test server exited with code ${child.exitCode ?? child.signalCode}.${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      if ((await fetchLocal(`${baseUrl}/api/auth/session`)).ok) return
    } catch {}
    await delay(300)
  }
  throw new Error('Nuxt ATT test server did not become ready within 60 seconds.')
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
  assert.ok(setCookie, 'successful login should set a session cookie')
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

async function addMembership(
  database: postgres.Sql,
  fixture: Pick<AttendanceFixture, 'teacherId' | 'schoolId' | 'classId' | 'semesterId'>,
  fullName: string,
  startsOn: string,
  endsOn: string | null,
): Promise<string> {
  const student = await createStudent(database, { fullName })
  const membership = await withAuditActor(database, fixture.teacherId, (transaction) => addStudentToSemester(transaction, {
    semesterId: fixture.semesterId,
    schoolId: fixture.schoolId,
    schoolClassId: fixture.classId,
    studentId: student.id,
    startsOn,
    endsOn,
  }))
  return membership.id
}

async function createFixture(
  database: postgres.Sql,
  accountDatabase: postgres.Sql,
  input: { password: string; emailSuffix: string; setupRoutine: boolean },
): Promise<AttendanceFixture> {
  const email = `att-${input.emailSuffix}-${randomUUID()}@example.invalid`
  const teacher = await provisionTeacherAccount(accountDatabase, email, await passwordHasher.make(input.password))
  const school = await createSchool(database, { teacherId: teacher.id, name: 'Sekolah Absensi Uji', timeZone: 'Asia/Jakarta' })
  const schoolClass = await createSchoolClass(database, { schoolId: school.id, name: 'Kelas Uji' })
  const [local] = await database<{ today: string }[]>`select school_local_today(${school.id})::text as today`
  const today = local.today
  const semesterStart = dateShift(today, -10)
  const semesterEnd = dateShift(today, 30)
  const semester = await withAuditActor(database, teacher.id, (transaction) => createSemester(transaction, {
    schoolId: school.id,
    academicYear: '2026/2027',
    term: 'ganjil',
    startsOn: semesterStart,
    endsOn: semesterEnd,
  }))
  const fixture: AttendanceFixture = {
    teacherId: teacher.id,
    email,
    password: input.password,
    schoolId: school.id,
    classId: schoolClass.id,
    semesterId: semester.id,
    today,
    semesterStart,
    semesterEnd,
    memberOneId: '',
    memberTwoId: '',
    memberFutureId: '',
    memberEndedId: '',
  }
  fixture.memberOneId = await addMembership(database, fixture, 'Siswa Absensi Satu', dateShift(today, -2), today)
  fixture.memberTwoId = await addMembership(database, fixture, 'Siswa Absensi Dua', today, null)
  fixture.memberFutureId = await addMembership(database, fixture, 'Siswa Belum Masuk', dateShift(today, 1), null)
  fixture.memberEndedId = await addMembership(database, fixture, 'Siswa Sudah Keluar', semesterStart, dateShift(today, -1))
  if (input.setupRoutine) {
    await withAuditActor(database, teacher.id, (transaction) => saveSchoolRoutine(transaction, {
      teacherId: teacher.id,
      effectiveFrom: semesterStart,
      schoolDays: [0, 1, 2, 3, 4, 5, 6],
    }))
  }
  return fixture
}

async function waitForAdvisoryLockState(
  database: postgres.Sql,
  lockClass: number,
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

test('ATT protected daily attendance preserves drafts, audit history, day revisions and semester-close serialization', { timeout: 240_000 }, async (t) => {
  for (const name of ['LAB002_TEST_DATABASE_URL', 'DATABASE_URL', 'NUXT_DATABASE_URL']) {
    const value = process.env[name]
    if (!value) continue
    let target: URL
    try { target = new URL(value) } catch { throw new Error(`ATT test target in ${name} is invalid.`) }
    if (!['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname !== '127.0.0.1'
      || target.port !== '55432'
      || target.pathname !== '/lab002_local') {
      throw new Error('ATT tests only create a disposable PostgreSQL 16 cluster; persistent or remote targets are rejected.')
    }
  }

  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const database = postgres(temporary.runtimeUrl, { max: 8, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined
  let baseUrl = ''
  let ownerCookie = ''
  let fixture: AttendanceFixture | undefined
  const password = randomBytes(24).toString('base64url')
  const sessionPassword = randomBytes(48).toString('base64url')

  try {
    const migrations = await runMigrations(migrator, 'up')
    const expectedNames = await listMigrationNames()
    assert.deepEqual(migrations.map((migration) => migration.name), expectedNames)
    assert.deepEqual(migrations.map((migration) => migration.applied), expectedNames.map(() => true))

    fixture = await createFixture(database, migrator, { password, emailSuffix: 'primary', setupRoutine: false })
    const foreignTeacher = await createTeacherAccount(migrator, `foreign-${randomUUID()}@example.invalid`)
    const foreignSchool = await createSchool(database, { teacherId: foreignTeacher.id, name: 'Sekolah Guru Lain', timeZone: 'Asia/Jakarta' })
    await createSchoolClass(database, { schoolId: foreignSchool.id, name: 'Kelas Guru Lain' })
    const foreignSemester = await createSemester(database, {
      schoolId: foreignSchool.id,
      academicYear: '2026/2027',
      term: 'ganjil',
      startsOn: fixture.today,
      endsOn: fixture.semesterEnd,
    })
    const foreignFixture = { ...fixture, teacherId: foreignTeacher.id, schoolId: foreignSchool.id, semesterId: foreignSemester.id }
    const port = await availablePort()
    baseUrl = `http://127.0.0.1:${port}`
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
    server.stdout?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    server.stderr?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    await waitForServer(server, baseUrl, () => serverOutput, [password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    const ownerLogin = await fetchLocal(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email: fixture.email, password }),
    })
    assert.equal(ownerLogin.status, 200)
    ownerCookie = cookieFrom(ownerLogin)
    const dayUrl = (target: AttendanceFixture, date = target.today) => `/api/attendance/${target.semesterId}/${date}`
    const getDay = async (target: AttendanceFixture, cookie: string, date = target.today) => {
      const response = await fetchLocal(`${baseUrl}${dayUrl(target, date)}`, { headers: { cookie } })
      return { response, body: await jsonResponse(response) }
    }
    const putDay = (target: AttendanceFixture, cookie: string, date: string, body: unknown, origin = baseUrl) => fetchLocal(`${baseUrl}${dayUrl(target, date)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin, cookie },
      body: JSON.stringify(body),
    })

    await t.test('protected GET is read-only, returns only eligible members, and distinguishes unset calendar from an owned semester', async () => {
      assert.equal((await fetchLocal(`${baseUrl}${dayUrl(fixture!)}`)).status, 401)
      const [before] = await database<{ attendance_count: number; audit_count: number }[]>`
        select (select count(*)::int from attendance_records where semester_id = ${fixture!.semesterId}) as attendance_count,
               (select count(*)::int from audit_events) as audit_count
      `
      const { response, body } = await getDay(fixture!, ownerCookie)
      const diagnostics = sanitizeServerOutput(serverOutput, [password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])
      assert.equal(response.status, 200, diagnostics)
      assert.equal(body.schoolLocalToday, fixture!.today)
      assert.equal(body.date, fixture!.today)
      assert.equal(body.readOnlyReason, 'calendar_unset')
      assert.equal(body.routineConfigured, false)
      assert.equal(body.isSchoolDay, false)
      assert.equal(body.historyCount, 0)
      const roster = body.roster as Array<Record<string, unknown>>
      assert.equal(roster.length, 2)
      assert.deepEqual(roster.map((member) => member.id).sort(), [fixture!.memberOneId, fixture!.memberTwoId].sort())
      assert.ok(roster.every((member) => member.status === null), 'A new day starts with blank status values.')
      assert.match(String(body.revision), /^[A-Za-z0-9_-]{43}$/)
      const [after] = await database<{ attendance_count: number; audit_count: number }[]>`
        select (select count(*)::int from attendance_records where semester_id = ${fixture!.semesterId}) as attendance_count,
               (select count(*)::int from audit_events) as audit_count
      `
      assert.deepEqual(after, before, 'GET must not create attendance or audit rows.')

      await withAuditActor(database, fixture!.teacherId, (transaction) => saveSchoolRoutine(transaction, {
        teacherId: fixture!.teacherId,
        effectiveFrom: fixture!.semesterStart,
        schoolDays: [0, 1, 2, 3, 4, 5, 6],
      }))
      const configured = await getDay(fixture!, ownerCookie)
      assert.equal(configured.response.status, 200)
      assert.equal(configured.body.readOnlyReason, null)
      assert.equal(configured.body.routineConfigured, true)
      assert.equal(configured.body.isSchoolDay, true)

      const foreignRead = await fetchLocal(`${baseUrl}${dayUrl(foreignFixture)}`, { headers: { cookie: ownerCookie } })
      assert.equal(foreignRead.status, 404)
      const foreignHistory = await fetchLocal(`${baseUrl}/api/attendance/history?semesterId=${foreignFixture.semesterId}&date=${foreignFixture.today}`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(foreignHistory.status, 404)
      const outOfPeriod = await fetchLocal(`${baseUrl}${dayUrl(fixture!, dateShift(fixture!.today, -20))}`, { headers: { cookie: ownerCookie } })
      assert.equal(outOfPeriod.status, 422)
    })

    await t.test('same-origin checks and complete payload validation prevent identity spoofing and partial invalid writes', async () => {
      const { body } = await getDay(fixture!, ownerCookie)
      const payload = { revision: body.revision, entries: [{ membershipId: fixture!.memberOneId, status: 'H' }] }
      const missingOrigin = await fetchLocal(`${baseUrl}${dayUrl(fixture!)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', cookie: ownerCookie }, body: JSON.stringify(payload),
      })
      assert.equal(missingOrigin.status, 403)
      const crossOrigin = await putDay(fixture!, ownerCookie, fixture!.today, payload, 'https://other.example.invalid')
      assert.equal(crossOrigin.status, 403)
      const duplicate = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: body.revision,
        entries: [
          { membershipId: fixture!.memberOneId, status: 'H' },
          { membershipId: fixture!.memberOneId, status: 'S' },
        ],
      })
      assert.equal(duplicate.status, 422)
      const unknownColumn = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: body.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: 'H', actorId: fixture!.teacherId }],
      })
      assert.equal(unknownColumn.status, 422)
      const ineligible = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: body.revision,
        entries: [{ membershipId: fixture!.memberFutureId, status: 'H' }],
      })
      assert.equal(ineligible.status, 422)
      const [count] = await database<{ count: number }[]>`select count(*)::int as count from attendance_records where semester_id = ${fixture!.semesterId}`
      assert.equal(count.count, 0, 'Invalid requests must not write any attendance.')
    })

    await t.test('partial save, reload, correction, clear tombstone, re-entry and protected audit history work over HTTP', async () => {
      const initial = await getDay(fixture!, ownerCookie)
      assert.equal(initial.response.status, 200)
      const firstSave = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: initial.body.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: 'H' }],
      })
      assert.equal(firstSave.status, 200)
      const saved = await jsonResponse(firstSave)
      let roster = saved.roster as Array<Record<string, unknown>>
      assert.equal(roster.find((member) => member.id === fixture!.memberOneId)?.status, 'H')
      assert.equal(saved.unfilledCount, 1, 'Saving one member must leave the other status blank.')
      const reread = await getDay(fixture!, ownerCookie)
      assert.equal(reread.response.status, 200)
      assert.equal((reread.body.roster as Array<Record<string, unknown>>).find((member) => member.id === fixture!.memberOneId)?.status, 'H')

      const staleBeforeRosterChange = reread.body.revision
      const memberThreeId = await addMembership(database, fixture!, 'Siswa Baru Hari Ini', fixture!.today, null)
      const staleRosterSave = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: staleBeforeRosterChange,
        entries: [{ membershipId: fixture!.memberTwoId, status: 'S' }],
      })
      assert.equal(staleRosterSave.status, 409, 'A membership change must invalidate the entire day revision.')
      const afterRoster = await getDay(fixture!, ownerCookie)
      assert.equal((afterRoster.body.roster as Array<Record<string, unknown>>).length, 3)
      const [beforeHoliday] = await database<{ count: number }[]>`select count(*)::int as count from attendance_records where semester_id = ${fixture!.semesterId}`
      assert.equal(beforeHoliday.count, 1)

      await withAuditActor(database, fixture!.teacherId, (transaction) => setCalendarException(transaction, {
        schoolId: fixture!.schoolId,
        date: fixture!.today,
        kind: 'holiday',
        note: 'Libur sintetis',
        confirmedAttendanceImpact: true,
      }))
      const staleCalendarSave = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: afterRoster.body.revision,
        entries: [{ membershipId: fixture!.memberTwoId, status: 'S' }],
      })
      assert.equal(staleCalendarSave.status, 409, 'A calendar change must invalidate the day revision.')
      const holiday = await getDay(fixture!, ownerCookie)
      assert.equal(holiday.body.readOnlyReason, 'calendar_holiday')
      assert.equal(holiday.body.historyCount, 1)
      assert.equal((holiday.body.roster as Array<Record<string, unknown>>).find((member) => member.id === fixture!.memberOneId)?.status, null)

      await withAuditActor(database, fixture!.teacherId, (transaction) => setCalendarException(transaction, {
        schoolId: fixture!.schoolId,
        date: fixture!.today,
        kind: 'school_day',
        note: 'Kegiatan sekolah sintetis',
        confirmedAttendanceImpact: true,
      }))
      const restoredCalendar = await getDay(fixture!, ownerCookie)
      assert.equal(restoredCalendar.body.readOnlyReason, null)
      assert.equal((restoredCalendar.body.roster as Array<Record<string, unknown>>).find((member) => member.id === fixture!.memberOneId)?.status, null,
        'Changing a holiday back to a school day must not revive excluded attendance.')
      const batchSave = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: restoredCalendar.body.revision,
        entries: [
          { membershipId: fixture!.memberOneId, status: 'S' },
          { membershipId: fixture!.memberTwoId, status: 'A' },
        ],
      })
      assert.equal(batchSave.status, 200)
      let current = await jsonResponse(batchSave)
      assert.equal(current.unfilledCount, 1)

      const correction = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: current.revision,
        entries: [{ membershipId: fixture!.memberTwoId, status: 'I' }],
      })
      assert.equal(correction.status, 200)
      current = await jsonResponse(correction)
      roster = current.roster as Array<Record<string, unknown>>
      assert.equal(roster.find((member) => member.id === fixture!.memberTwoId)?.status, 'I')

      const cleared = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: current.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: null }],
      })
      assert.equal(cleared.status, 200)
      current = await jsonResponse(cleared)
      assert.equal((current.roster as Array<Record<string, unknown>>).find((member) => member.id === fixture!.memberOneId)?.status, null)
      assert.equal(current.unfilledCount, 2)
      const [manualClear] = await database<{ id: string; status: string | null; version: number; is_effective: boolean }[]>`
        select id, status, version, is_effective
        from attendance_records
        where membership_id = ${fixture!.memberOneId} and attendance_date = ${fixture!.today}::date
          and exclusion_reason = 'manual_clear'
      `
      assert.ok(manualClear)
      assert.equal(manualClear.status, null)
      assert.equal(manualClear.version, 2)
      assert.equal(manualClear.is_effective, false)
      const [clearAudit] = await database<{ actor_teacher_id: string; old_status: string; new_status: string | null }[]>`
        select actor_teacher_id::text as actor_teacher_id,
               old_value ->> 'status' as old_status,
               new_value ->> 'status' as new_status
        from audit_events
        where entity_type = 'attendance_records' and entity_id = ${manualClear.id}
          and new_value ->> 'exclusion_reason' = 'manual_clear'
      `
      assert.equal(clearAudit.actor_teacher_id, fixture!.teacherId)
      assert.equal(clearAudit.old_status, 'S')
      assert.equal(clearAudit.new_status, null)

      const afterClear = await getDay(fixture!, ownerCookie)
      const reentered = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: afterClear.body.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: 'H' }],
      })
      assert.equal(reentered.status, 200, 'An explicit new attendance after a clear creates a separate effective row.')
      const [rows] = await database<{ count: number; clear_count: number; effective_count: number }[]>`
        select count(*)::int as count,
               count(*) filter (where exclusion_reason = 'manual_clear')::int as clear_count,
               count(*) filter (where is_effective)::int as effective_count
        from attendance_records where membership_id = ${fixture!.memberOneId} and attendance_date = ${fixture!.today}::date
      `
      assert.equal(rows.count, 3, 'The original holiday record, clear tombstone and re-entry remain separate.')
      assert.equal(rows.clear_count, 1)
      assert.equal(rows.effective_count, 1)

      const historyResponse = await fetchLocal(`${baseUrl}/api/attendance/history?semesterId=${fixture!.semesterId}&date=${fixture!.today}`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(historyResponse.status, 200)
      const items = (await jsonResponse(historyResponse)).history as Array<Record<string, unknown>>
      assert.ok(items.some((item) => item.studentName === 'Siswa Absensi Satu'
        && item.statusBefore === 'S' && item.statusAfter === null
        && item.isEffective === false && item.exclusionReason === 'manual_clear'
        && item.actorTeacherId === fixture!.teacherId))
      assert.ok(items.some((item) => item.statusBefore === 'A' && item.statusAfter === 'I'), 'Corrections retain both old and new values.')
    })

    await t.test('future dates are read-only and clear guards require a school day', async () => {
      const futureDate = dateShift(fixture!.today, 1)
      const futureView = await getDay(fixture!, ownerCookie, futureDate)
      assert.equal(futureView.response.status, 200)
      assert.equal(futureView.body.readOnlyReason, 'future_date')
      const futureWrite = await putDay(fixture!, ownerCookie, futureDate, {
        revision: futureView.body.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: 'H' }],
      })
      assert.equal(futureWrite.status, 409)

      const guardDate = dateShift(fixture!.today, -1)
      const guardDay = await getDay(fixture!, ownerCookie, guardDate)
      assert.equal(guardDay.response.status, 200)
      const guardSave = await putDay(fixture!, ownerCookie, guardDate, {
        revision: guardDay.body.revision,
        entries: [{ membershipId: fixture!.memberOneId, status: 'H' }],
      })
      assert.equal(guardSave.status, 200)
      const [effective] = await database<{ id: string }[]>`
        select id from attendance_records
        where membership_id = ${fixture!.memberOneId} and attendance_date = ${guardDate}::date and is_effective
      `
      assert.ok(effective)
      await migrator.unsafe('ALTER TABLE school_calendar_rules DISABLE TRIGGER school_calendar_rules_guard_write').simple()
      try {
        await migrator`
          update school_calendar_rules
          set is_school_day = false
          where school_id = ${fixture!.schoolId}
            and day_of_week = extract(dow from ${guardDate}::date)::smallint
            and effective_from = ${fixture!.semesterStart}::date
        `
        await assert.rejects(
          withAuditActor(database, fixture!.teacherId, async (transaction) => {
            await transaction`select set_config('app.attendance_clear_confirmed', 'on', true)`
            await transaction`
              update attendance_records
              set status = null, version = version + 1, is_effective = false,
                  exclusion_reason = 'manual_clear', excluded_at = clock_timestamp(),
                  excluded_by_calendar_exception_id = null
              where id = ${effective.id}
            `
          }),
          (error: { code?: string }) => error.code === '23514',
          'The database guard must reject manual clear on a non-school day even when the HTTP service is bypassed.',
        )
      } finally {
        await migrator`
          update school_calendar_rules
          set is_school_day = true
          where school_id = ${fixture!.schoolId}
            and day_of_week = extract(dow from ${guardDate}::date)::smallint
            and effective_from = ${fixture!.semesterStart}::date
        `
        await migrator.unsafe('ALTER TABLE school_calendar_rules ENABLE TRIGGER school_calendar_rules_guard_write').simple()
      }
      const [preserved] = await database<{ status: string; is_effective: boolean }[]>`select status, is_effective from attendance_records where id = ${effective.id}`
      assert.equal(preserved.status, 'H')
      assert.equal(preserved.is_effective, true)
    })

    await t.test('failed batch is atomic and a queued save cannot cross semester closure', async () => {
      const beforeFailure = await getDay(fixture!, ownerCookie)
      const triggerName = `zz_att_test_fail_${randomUUID().replaceAll('-', '')}`
      const functionName = `att_test_fail_${randomUUID().replaceAll('-', '')}`
      await migrator.unsafe(`
        create function public.${functionName}() returns trigger language plpgsql as $$
        begin
          if new.membership_id = '${fixture!.memberTwoId}'::uuid then
            raise exception 'synthetic failure after earlier attendance update' using errcode = '23514';
          end if;
          return new;
        end $$
      `).simple()
      await migrator.unsafe(`create trigger ${triggerName} before insert or update on public.attendance_records for each row execute function public.${functionName}()`).simple()
      const beforeRows = await database`select id, membership_id, status, version from attendance_records where semester_id = ${fixture!.semesterId} and attendance_date = ${fixture!.today}::date order by membership_id, id`
      const failed = await putDay(fixture!, ownerCookie, fixture!.today, {
        revision: beforeFailure.body.revision,
        entries: [
          { membershipId: fixture!.memberOneId, status: 'S' },
          { membershipId: fixture!.memberTwoId, status: 'A' },
        ],
      })
      assert.equal(failed.status, 422)
      const afterRows = await database`select id, membership_id, status, version from attendance_records where semester_id = ${fixture!.semesterId} and attendance_date = ${fixture!.today}::date order by membership_id, id`
      assert.deepEqual(afterRows, beforeRows, 'A database error after an earlier row operation must roll the whole batch back.')
      await migrator.unsafe(`drop trigger ${triggerName} on public.attendance_records`).simple()
      await migrator.unsafe(`drop function public.${functionName}()`).simple()

      const closePreview = await getSemesterClosurePreview(database, { semesterId: fixture!.semesterId, teacherId: fixture!.teacherId })
      assert.ok(closePreview)
      let releaseGate!: () => void
      let signalGateReached!: () => void
      const gateReached = new Promise<void>((resolve) => { signalGateReached = resolve })
      const gateRelease = new Promise<void>((resolve) => { releaseGate = resolve })
      const holdGate = database.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(1727, hashtext(${fixture!.schoolId}::text))`
        signalGateReached()
        await gateRelease
      })
      let closeRequest: Promise<Awaited<ReturnType<typeof closeSemester>>> | null = null
      let saveRequest: Promise<Response> | null = null
      let addStudentRequest: Promise<Response> | null = null
      let setupError: unknown
      try {
        await gateReached
        closeRequest = withAuditActor(database, fixture!.teacherId, (transaction) => closeSemester(transaction, {
          semesterId: fixture!.semesterId,
          teacherId: fixture!.teacherId,
          previewToken: closePreview.previewToken,
          confirmed: true,
        }))
        await waitForAdvisoryLockState(database, 1727, 1, 1)
        await waitForAdvisoryLockState(database, 1728, 1, 0)
        const queuedDay = await getDay(fixture!, ownerCookie)
        saveRequest = putDay(fixture!, ownerCookie, fixture!.today, {
          revision: queuedDay.body.revision,
          entries: [{ membershipId: fixture!.memberTwoId, status: 'S' }],
        })
        addStudentRequest = fetchLocal(`${baseUrl}/api/students`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({
            semesterId: fixture!.semesterId,
            fullName: 'Siswa Uji R03',
            studentNumber: 'ATT-R03',
            startsOn: fixture!.today,
          }),
        })
        await waitForAdvisoryLockState(database, 1728, 1, 2)
      } catch (error) {
        setupError = error
      } finally {
        releaseGate()
      }

      const settle = <T>(promise: Promise<T>) => promise.then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      )
      const [closeResult, saveResult, addStudentResult] = await Promise.all([
        closeRequest ? settle(closeRequest) : Promise.resolve({ ok: false as const, error: new Error('Close request was not started.') }),
        saveRequest ? settle(saveRequest) : Promise.resolve({ ok: false as const, error: new Error('Attendance request was not started.') }),
        addStudentRequest ? settle(addStudentRequest) : Promise.resolve({ ok: false as const, error: new Error('Student request was not started.') }),
        settle(holdGate),
      ]).then((results) => results.slice(0, 3))
      if (setupError) throw setupError
      if (!closeResult.ok) throw closeResult.error
      if (!saveResult.ok) throw saveResult.error
      if (!addStudentResult.ok) throw addStudentResult.error
      assert.equal(closeResult.value.semester.status, 'closed', 'The close transaction must not deadlock with an add-student request.')
      assert.equal(saveResult.value.status, 409, 'The close transaction was queued first; the later attendance save must not write into its archive.')
      assert.equal(addStudentResult.value.status, 409, 'A roster add queued behind closure must be rejected after the semester closes.')
      const [archive] = await database<{ status: string; late_membership_count: number; orphan_student_count: number }[]>`
        select semester.status,
               (select count(*)::int from semester_memberships where semester_id = semester.id and student_id in (select id from students where student_number = 'ATT-R03')) as late_membership_count,
               (select count(*)::int from students where student_number = 'ATT-R03') as orphan_student_count
        from semesters as semester where semester.id = ${fixture!.semesterId}
      `
      assert.equal(archive.status, 'closed')
      assert.equal(archive.late_membership_count, 0)
      assert.equal(archive.orphan_student_count, 0, 'The rejected roster add must not leave a student without membership.')
    })

    await t.test('migration rollback refuses to erase recorded manual-clear history', async () => {
      await assert.rejects(runMigrations(migrator, 'down'), /cannot roll back attendance manual-clear history/)
      const [ledger] = await migrator<{ count: number }[]>`select count(*)::int as count from schema_migrations where name = '0004_attendance_manual_clear'`
      assert.equal(ledger.count, 1, 'A refused rollback must leave migration history in place.')
      const [nullable] = await migrator<{ is_nullable: string }[]>`
        select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'attendance_records' and column_name = 'status'
      `
      assert.equal(nullable.is_nullable, 'YES')
    })
  } finally {
    if (server) await stopOwnedProcess(server)
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
    await Promise.all([database.end({ timeout: 3 }), migrator.end({ timeout: 3 })])
    await temporary.cleanup()
  }
})
