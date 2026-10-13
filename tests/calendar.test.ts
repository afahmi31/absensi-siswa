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
import { createSemester } from '../server/database/repositories/semesters.ts'
import { addStudentToSemester, createStudent } from '../server/database/repositories/students.ts'
import { createSchool, createSchoolClass } from '../server/database/repositories/schools.ts'
import { createTeacherAccount } from '../server/database/repositories/teacher-accounts.ts'
import { getSchoolCalendarView, setCalendarException } from '../server/database/repositories/calendar.ts'
import { startTemporaryPostgres } from './support/temporary-postgres.mjs'
import { listMigrationNames } from './support/migration-names.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = path.join(appRoot, '.data', 'tests')
const passwordHasher = new Scrypt({})
const requestTimeoutMs = 5_000

interface CalendarFixture {
  teacherId: string
  schoolId: string
  semesterId: string
  today: string
  semesterStart: string
  semesterEnd: string
  membershipDate: string
  membershipOneId: string
  membershipTwoId: string
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
  const root = await mkdtemp(path.join(testRoot, 'calendar-nuxt-root-'))
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
  if (path.dirname(resolved).toLowerCase() !== ownedRoot.toLowerCase() || !/^calendar-nuxt-root-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new Error('Refusing to remove an isolated Nuxt project outside the generated calendar test directory.')
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
      throw new Error(`Nuxt CAL test server exited with code ${child.exitCode ?? child.signalCode}.${diagnostics ? `\n${diagnostics}` : ''}`)
    }
    try {
      if ((await fetchLocal(`${baseUrl}/api/auth/session`)).ok) return
    } catch {}
    await delay(300)
  }
  throw new Error('Nuxt CAL test server did not become ready within 60 seconds.')
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

function errorData(body: Record<string, unknown>): Record<string, unknown> {
  return typeof body.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : {}
}

function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + offset))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

async function createCalendarFixture(
  database: postgres.Sql,
  teacherId: string,
  name: string,
  semesterShiftDays = 0,
): Promise<CalendarFixture> {
  const school = await createSchool(database, { teacherId, name, timeZone: 'Asia/Jakarta' })
  const schoolClass = await createSchoolClass(database, { schoolId: school.id, name: 'Kelas Uji' })
  const [local] = await database<{ today: string }[]>`select school_local_today(${school.id})::text as today`
  const today = local.today
  const semesterStart = addDays(today, semesterShiftDays - 10)
  const semesterEnd = addDays(today, semesterShiftDays + 90)
  const membershipDate = addDays(today, semesterShiftDays - 3)
  const membershipEnd = semesterEnd < today ? semesterEnd : today
  const semester = await createSemester(database, {
    schoolId: school.id,
    academicYear: '2026/2027',
    term: 'ganjil',
    startsOn: semesterStart,
    endsOn: semesterEnd,
  })
  const studentOne = await createStudent(database, { fullName: 'Siswa Kalender Satu' })
  const studentTwo = await createStudent(database, { fullName: 'Siswa Kalender Dua' })
  const membershipOne = await addStudentToSemester(database, {
    semesterId: semester.id,
    schoolId: school.id,
    schoolClassId: schoolClass.id,
    studentId: studentOne.id,
    startsOn: membershipDate,
    endsOn: membershipEnd,
  })
  const membershipTwo = await addStudentToSemester(database, {
    semesterId: semester.id,
    schoolId: school.id,
    schoolClassId: schoolClass.id,
    studentId: studentTwo.id,
    startsOn: membershipDate,
    endsOn: membershipEnd,
  })
  await setCalendarException(database, { schoolId: school.id, date: membershipDate, kind: 'school_day', note: 'Fixture sintetis' })
  await setCalendarException(database, { schoolId: school.id, date: membershipEnd, kind: 'school_day', note: 'Fixture sintetis' })
  return {
    teacherId,
    schoolId: school.id,
    semesterId: semester.id,
    today,
    semesterStart,
    semesterEnd,
    membershipDate,
    membershipOneId: membershipOne.id,
    membershipTwoId: membershipTwo.id,
  }
}

async function waitForAdvisoryLockState(
  database: postgres.Sql,
  lockClass: 1727 | 1728,
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

test('CAL calendar APIs preserve ownership, weekly rules, attendance history, archive locks and close-race ordering', { timeout: 240_000 }, async (t) => {
  for (const name of ['LAB002_TEST_DATABASE_URL', 'DATABASE_URL', 'NUXT_DATABASE_URL']) {
    const value = process.env[name]
    if (!value) continue
    let target: URL
    try { target = new URL(value) } catch { throw new Error(`CAL test target in ${name} is invalid.`) }
    if (!['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname !== '127.0.0.1'
      || target.port !== '55432'
      || target.pathname !== '/lab002_local') {
      throw new Error('CAL tests only create a disposable PostgreSQL 16 cluster; persistent or remote targets are rejected.')
    }
  }

  const temporary = await startTemporaryPostgres()
  const migrator = postgres(temporary.migrationUrl, { max: 1, connect_timeout: 5 })
  const appDatabase = postgres(temporary.runtimeUrl, { max: 6, connect_timeout: 5 })
  let server: ReturnType<typeof spawn> | undefined
  let serverOutput = ''
  let isolatedNuxtRoot: string | undefined
  let baseUrl = ''
  let ownerCookie = ''
  let ownerId = ''
  let fixture: CalendarFixture | undefined
  const password = randomBytes(24).toString('base64url')

  try {
    const migrations = await runMigrations(migrator, 'up')
    const expectedNames = await listMigrationNames()
    assert.deepEqual(migrations.map((migration) => migration.name), expectedNames)
    assert.deepEqual(migrations.map((migration) => migration.applied), expectedNames.map(() => true))

    const email = `calendar-${randomUUID()}@example.invalid`
    const owner = await provisionTeacherAccount(migrator, email, await passwordHasher.make(password))
    ownerId = owner.id
    fixture = await createCalendarFixture(appDatabase, ownerId, 'Sekolah Kalender Uji')
    const foreignTeacher = await createTeacherAccount(migrator, `foreign-${randomUUID()}@example.invalid`)
    const foreignFixture = await createCalendarFixture(appDatabase, foreignTeacher.id, 'Sekolah Milik Guru Lain')
    const priorTeacher = await createTeacherAccount(migrator, `prior-${randomUUID()}@example.invalid`)
    const priorFixture = await createCalendarFixture(appDatabase, priorTeacher.id, 'Sekolah Semester Lampau', -120)
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
    server.stdout?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    server.stderr?.on('data', (chunk: Buffer) => { serverOutput = `${serverOutput}${chunk.toString('utf8')}`.slice(-16_000) })
    await waitForServer(server, baseUrl, () => serverOutput, [password, sessionPassword, temporary.runtimeUrl, temporary.migrationUrl])

    await t.test('authentication, origin and owner scope protect calendar reads and writes', async () => {
      assert.equal((await fetchLocal(`${baseUrl}/api/calendar`)).status, 401)
      const anonymousWrite = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ effectiveFrom: fixture!.membershipDate, schoolDays: [1, 2, 3, 4, 5] }),
      })
      assert.equal(anonymousWrite.status, 401)

      const login = await fetchLocal(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password }),
      })
      assert.equal(login.status, 200)
      ownerCookie = cookieFrom(login)

      const crossOrigin = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: 'https://outside.example', cookie: ownerCookie },
        body: JSON.stringify({ effectiveFrom: fixture!.membershipDate, schoolDays: [1, 2, 3, 4, 5] }),
      })
      assert.equal(crossOrigin.status, 403)

      const foreignSchoolRead = await fetchLocal(`${baseUrl}/api/calendar?schoolId=${foreignFixture.schoolId}`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(foreignSchoolRead.status, 200)
      const foreignAttempt = await jsonResponse(foreignSchoolRead)
      assert.equal((foreignAttempt.school as Record<string, unknown>).id, fixture!.schoolId)
      assert.notEqual((foreignAttempt.school as Record<string, unknown>).id, foreignFixture.schoolId)

      const badMonth = await fetchLocal(`${baseUrl}/api/calendar?month=2026-02-30`, { headers: { cookie: ownerCookie } })
      assert.equal(badMonth.status, 422)
      const invalidDate = await fetchLocal(`${baseUrl}/api/calendar/exceptions/2026-02-30`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'holiday', note: '' }),
      })
      assert.equal(invalidDate.status, 404)
      const forbiddenIdentity = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ schoolId: foreignFixture.schoolId, effectiveFrom: fixture!.membershipDate, schoolDays: [] }),
      })
      assert.equal(forbiddenIdentity.status, 422)
    })

    await t.test('unset calendar stays unset; seven weekdays save atomically and use PostgreSQL DOW', async () => {
      const [auditBeforeRead] = await appDatabase<{ count: number }[]>`select count(*)::int as count from audit_events`
      const initialResponse = await fetchLocal(`${baseUrl}/api/calendar`, { headers: { cookie: ownerCookie } })
      assert.equal(initialResponse.status, 200)
      const initial = await jsonResponse(initialResponse)
      assert.equal((initial.semester as Record<string, unknown>).id, fixture!.semesterId)
      assert.equal(initial.schoolLocalToday, fixture!.today)
      assert.deepEqual(initial.routineRules, [], 'No implicit Monday-to-Friday routine is introduced.')
      const initialDays = initial.days as Record<string, unknown>[]
      assert.ok(initialDays.every((day) => day.routineConfigured === false))
      const priorCalendar = await getSchoolCalendarView(appDatabase, { teacherId: priorFixture.teacherId })
      assert.ok(priorCalendar.schoolLocalToday! > priorFixture.semesterEnd, 'The local date is after the synthetic active semester.')
      assert.equal(priorCalendar.month, priorFixture.semesterEnd.slice(0, 7), 'The default month stays within the active semester when today is later.')
      assert.ok(priorCalendar.days.length > 0 && priorCalendar.days.every((day) => day.date <= priorFixture.semesterEnd))
      const [auditAfterRead] = await appDatabase<{ count: number }[]>`select count(*)::int as count from audit_events`
      assert.equal(auditAfterRead.count, auditBeforeRead.count, 'Reading a month must not write audit or calendar data.')

      const routineResponse = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ effectiveFrom: fixture!.membershipDate, schoolDays: [1, 2, 3, 4, 5] }),
      })
      assert.equal(routineResponse.status, 200)
      const rules = (await jsonResponse(routineResponse)).rules as Record<string, unknown>[]
      assert.equal(rules.length, 7)
      assert.deepEqual(rules.map((rule) => [rule.dayOfWeek, rule.isSchoolDay]), [
        [0, false], [1, true], [2, true], [3, true], [4, true], [5, true], [6, false],
      ])
      const [stored] = await appDatabase<{ count: number; actor_count: number }[]>`
        select count(*)::int as count,
               count(*) filter (where actor_teacher_id = ${ownerId})::int as actor_count
        from audit_events
        where entity_type = 'school_calendar_rules' and event_date = ${fixture!.membershipDate}::date
      `
      assert.equal(stored.count, 7)
      assert.equal(stored.actor_count, 7)

      const [databaseDow] = await appDatabase<{ day_of_week: number }[]>`
        select extract(dow from ${fixture!.membershipDate}::date)::smallint as day_of_week
      `
      const monthResponse = await fetchLocal(`${baseUrl}/api/calendar?month=${fixture!.membershipDate.slice(0, 7)}`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(monthResponse.status, 200)
      const month = await jsonResponse(monthResponse)
      const day = (month.days as Record<string, unknown>[]).find((record) => record.date === fixture!.membershipDate)
      assert.equal(day?.dayOfWeek, databaseDow.day_of_week)
      assert.equal(day?.routineConfigured, true)
      assert.equal(day?.isSchoolDay, true, 'The explicit date exception takes precedence and is still a school day.')

      const allOffDate = addDays(fixture!.today, 2)
      const allOffResponse = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ effectiveFrom: allOffDate, schoolDays: [] }),
      })
      assert.equal(allOffResponse.status, 200)
      assert.ok(((await jsonResponse(allOffResponse)).rules as Record<string, unknown>[]).every((rule) => rule.isSchoolDay === false))

      await appDatabase`
        insert into attendance_records (membership_id, semester_id, attendance_date, status)
        values (${fixture!.membershipOneId}, ${fixture!.semesterId}, ${fixture!.membershipDate}, 'H')
      `
      const beforeConflict = await appDatabase<{ day_of_week: number; is_school_day: boolean }[]>`
        select day_of_week, is_school_day from school_calendar_rules
        where school_id = ${fixture!.schoolId} and effective_from = ${fixture!.membershipDate}::date
        order by day_of_week
      `
      const conflictingRoutine = await fetchLocal(`${baseUrl}/api/calendar/routine`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ effectiveFrom: fixture!.membershipDate, schoolDays: [0, 6] }),
      })
      assert.equal(conflictingRoutine.status, 409)
      const afterConflict = await appDatabase<{ day_of_week: number; is_school_day: boolean }[]>`
        select day_of_week, is_school_day from school_calendar_rules
        where school_id = ${fixture!.schoolId} and effective_from = ${fixture!.membershipDate}::date
        order by day_of_week
      `
      assert.deepEqual(afterConflict, beforeConflict, 'A rejected weekday update rolls back all seven days.')
    })

    await t.test('date confirmation refreshes impact and keeps excluded attendance as inactive history', async () => {
      const firstPreviewResponse = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'holiday', note: 'Hari libur uji' }),
      })
      assert.equal(firstPreviewResponse.status, 409)
      const firstPreviewBody = await jsonResponse(firstPreviewResponse)
      const firstPreview = errorData(firstPreviewBody)
      assert.equal(firstPreview.reason, 'attendance_confirmation_required')
      assert.deepEqual(firstPreview.impact, { attendanceHistoryCount: 1, effectiveAttendanceCount: 1 })
      assert.equal(typeof firstPreview.previewToken, 'string')

      await appDatabase`
        insert into attendance_records (membership_id, semester_id, attendance_date, status)
        values (${fixture!.membershipTwoId}, ${fixture!.semesterId}, ${fixture!.membershipDate}, 'I')
      `
      const staleConfirmation = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'holiday', note: 'Hari libur uji', previewToken: firstPreview.previewToken }),
      })
      assert.equal(staleConfirmation.status, 409)
      const staleBody = await jsonResponse(staleConfirmation)
      const latest = errorData(staleBody)
      assert.equal(latest.reason, 'preview_changed')
      assert.deepEqual(latest.impact, { attendanceHistoryCount: 2, effectiveAttendanceCount: 2 })
      assert.notEqual(latest.previewToken, firstPreview.previewToken)

      const savedHoliday = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'holiday', note: 'Hari libur uji', previewToken: latest.previewToken }),
      })
      assert.equal(savedHoliday.status, 200)
      const holidayResult = await jsonResponse(savedHoliday)
      assert.equal(holidayResult.excludedAttendanceCount, 2)
      const [historyAfterHoliday] = await appDatabase<{ total: number; effective: number }[]>`
        select count(*)::int as total, count(*) filter (where is_effective)::int as effective
        from attendance_records
        where semester_id = ${fixture!.semesterId} and attendance_date = ${fixture!.membershipDate}::date
      `
      assert.deepEqual(historyAfterHoliday, { total: 2, effective: 0 })
      const [effectiveView] = await appDatabase<{ count: number }[]>`
        select count(*)::int as count from effective_attendance
        where semester_id = ${fixture!.semesterId} and attendance_date = ${fixture!.membershipDate}::date
      `
      assert.equal(effectiveView.count, 0)

      const restorePreviewResponse = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'school_day', note: 'Hari sekolah kembali' }),
      })
      assert.equal(restorePreviewResponse.status, 409)
      const restorePreview = errorData(await jsonResponse(restorePreviewResponse))
      assert.deepEqual(restorePreview.impact, { attendanceHistoryCount: 2, effectiveAttendanceCount: 0 })
      const restoredSchoolDay = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'school_day', note: 'Hari sekolah kembali', previewToken: restorePreview.previewToken }),
      })
      assert.equal(restoredSchoolDay.status, 200)
      const [historyAfterRestore] = await appDatabase<{ total: number; effective: number }[]>`
        select count(*)::int as total, count(*) filter (where is_effective)::int as effective
        from attendance_records
        where semester_id = ${fixture!.semesterId} and attendance_date = ${fixture!.membershipDate}::date
      `
      assert.deepEqual(historyAfterRestore, { total: 2, effective: 0 }, 'Returning a date to a school day never reactivates old records.')
    })

    await t.test('semester closure and a calendar write use the same lock order; archived notes remain read-only', async () => {
      const previewResponse = await fetchLocal(`${baseUrl}/api/semesters/${fixture!.semesterId}/closure-preview`, {
        headers: { cookie: ownerCookie },
      })
      assert.equal(previewResponse.status, 200)
      const preview = (await jsonResponse(previewResponse)).preview as Record<string, unknown>
      let releaseCalendarGate!: () => void
      let signalCalendarGateReady!: () => void
      const releaseCalendarGatePromise = new Promise<void>((resolve) => { releaseCalendarGate = resolve })
      const calendarGateReady = new Promise<void>((resolve) => { signalCalendarGateReady = resolve })
      const calendarGate = appDatabase.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(1727, hashtext(${fixture!.schoolId}::text))`
        signalCalendarGateReady()
        await releaseCalendarGatePromise
      })
      await calendarGateReady

      let closeRequest: Promise<Response> | undefined
      let routineRequest: Promise<Response> | undefined
      let setupError: unknown
      try {
        closeRequest = fetchLocal(`${baseUrl}/api/semesters/${fixture!.semesterId}/close`, {
          method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ previewToken: preview.previewToken, confirmed: true }),
        })
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 0)
        await waitForAdvisoryLockState(appDatabase, 1727, 1, 1)
        routineRequest = fetchLocal(`${baseUrl}/api/calendar/routine`, {
          method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
          body: JSON.stringify({ effectiveFrom: fixture!.semesterStart, schoolDays: [1, 2, 3, 4, 5] }),
        })
        await waitForAdvisoryLockState(appDatabase, 1728, 1, 1)
      } catch (error) {
        setupError = error
      } finally {
        releaseCalendarGate()
      }
      await calendarGate
      if (setupError) {
        await Promise.allSettled([closeRequest, routineRequest].filter((request): request is Promise<Response> => Boolean(request)))
        throw setupError
      }
      assert.ok(closeRequest)
      assert.ok(routineRequest)
      const [closed, queuedMutation] = await Promise.all([closeRequest, routineRequest])
      assert.equal(closed.status, 200, 'The close proceeds after the shared calendar gate releases.')
      assert.equal(queuedMutation.status, 409, 'The queued CAL write observes the archived semester after closure.')
      const queuedBody = await jsonResponse(queuedMutation)
      assert.equal(errorData(queuedBody).reason, 'semester_closed')

      const auditBeforeNoteEdit = await appDatabase<{ count: number }[]>`
        select count(*)::int as count from audit_events where entity_type = 'calendar_exceptions'
      `
      const closedNoteOnly = await fetchLocal(`${baseUrl}/api/calendar/exceptions/${fixture!.membershipDate}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: ownerCookie },
        body: JSON.stringify({ kind: 'school_day', note: 'Catatan yang tidak boleh tersimpan' }),
      })
      assert.equal(closedNoteOnly.status, 409)
      assert.equal(errorData(await jsonResponse(closedNoteOnly)).reason, 'semester_closed')
      const auditAfterNoteEdit = await appDatabase<{ count: number }[]>`
        select count(*)::int as count from audit_events where entity_type = 'calendar_exceptions'
      `
      assert.equal(auditAfterNoteEdit[0]?.count, auditBeforeNoteEdit[0]?.count, 'A rejected note-only update writes no audit event.')

      const [exception] = await appDatabase<{ note: string | null; kind: string }[]>`
        select note, kind from calendar_exceptions where school_id = ${fixture!.schoolId}
          and exception_date = ${fixture!.membershipDate}::date
      `
      assert.deepEqual(exception, { note: 'Hari sekolah kembali', kind: 'school_day' })
    })
  } finally {
    if (server) await stopOwnedProcess(server)
    await appDatabase.end({ timeout: 3 })
    await migrator.end({ timeout: 3 })
    await temporary.cleanup()
    if (isolatedNuxtRoot) await removeIsolatedNuxtRoot(isolatedNuxtRoot)
  }
})
